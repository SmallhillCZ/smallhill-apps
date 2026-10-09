import { computed, effect, inject, Injectable, signal, untracked } from "@angular/core";
import { extension } from "../onedrive/items";
import { ExternalOutput, PlayerService, QueuedTrack } from "../player/player.service";

export const TOKEN_KEY = "player.sonos";
export const NOTICE_KEY = "player.sonos.notice";
const POLL = 3000;
const TICK = 500;
const URL_FRESH = 30 * 60 * 1000;
const URL_AHEAD = 25;
const URL_BEHIND = 2;
const CONTENT_TYPES: Record<string, string> = {
	mp3: "audio/mpeg",
	m4a: "audio/mp4",
	mp4: "audio/mp4",
	aac: "audio/aac",
	flac: "audio/flac",
	ogg: "audio/ogg",
	oga: "audio/ogg",
	wav: "audio/wav",
};

export type SonosNotice = "connected" | "connectError" | "reconnect" | "evicted" | "lost" | "error" | "nothingPlayable";

export interface SonosGroup {
	id: string;
	name: string;
	playbackState: string | null;
}

export interface SonosSource {
	canPlay(track: QueuedTrack): boolean;
	streamUrl(track: QueuedTrack): Promise<string | null>;
}

interface Cast {
	id: string;
	key: string;
	group: SonosGroup;
}

interface Item {
	id: string;
	title: string;
	artist?: string;
	album?: string;
	duration?: number | null;
	type: string;
	url: string | null;
}

interface Status {
	state: string;
	itemId: string | null;
	positionMillis: number;
}

class SonosRequestError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export function contentType(name: string): string | null {
	return CONTENT_TYPES[extension(name)] ?? null;
}

function readToken(): string | null {
	try {
		return localStorage.getItem(TOKEN_KEY);
	} catch {
		return null;
	}
}

function writeToken(token: string | null): void {
	try {
		if (token) localStorage.setItem(TOKEN_KEY, token);
		else localStorage.removeItem(TOKEN_KEY);
	} catch {}
}

function takeNotice(): SonosNotice | null {
	try {
		const notice = sessionStorage.getItem(NOTICE_KEY) as SonosNotice | null;
		sessionStorage.removeItem(NOTICE_KEY);
		return notice;
	} catch {
		return null;
	}
}

@Injectable({ providedIn: "root" })
export class SonosService {
	private readonly player = inject(PlayerService);
	private source: SonosSource | null = null;
	private token = readToken();
	private readonly prefix = Math.random().toString(36).slice(2, 8);
	private counter = 0;
	private readonly ids = new WeakMap<QueuedTrack, string>();
	private readonly urls = new Map<string, { url: string; at: number }>();
	private uploaded = "";
	private syncing: Promise<void> = Promise.resolve();
	private syncTimer = 0;
	private pollTimer = 0;
	private tickTimer = 0;
	private last: { status: Status; at: number; pos: number } | null = null;
	private wasPlaying = false;

	readonly enabled = signal(false);
	readonly connected = signal(!!this.token);
	readonly groups = signal<SonosGroup[] | null>(null);
	readonly groupsFailed = signal(false);
	readonly cast = signal<Cast | null>(null);
	readonly group = computed(() => this.cast()?.group ?? null);
	readonly notice = signal<SonosNotice | null>(takeNotice());

	private readonly output: ExternalOutput = {
		load: (pos, startAt, play) => this.load(pos, startAt, play),
		play: () => void this.control({ action: "play" }),
		pause: () => void this.control({ action: "pause" }),
		seek: (seconds) => {
			const itemId = this.itemAt(this.player.queue().pos);
			void this.control({
				action: "seek",
				positionMillis: Math.round(seconds * 1000),
				...(itemId ? { itemId } : {}),
			});
		},
		stop: () => {
			void this.control({ action: "pause" }).catch(() => {});
			this.finish();
		},
	};

	constructor() {
		effect(() => {
			this.player.tracks();
			this.player.queue().order;
			if (!this.cast()) return;
			untracked(() => this.scheduleSync());
		});
	}

	setSource(source: SonosSource): void {
		this.source = source;
	}

	async init(): Promise<void> {
		try {
			const response = await fetch(this.url("api/sonos/config"));
			const config = (await response.json()) as { enabled?: boolean };
			this.enabled.set(response.ok && config.enabled === true);
		} catch {
			this.enabled.set(false);
		}
	}

	connect(): void {
		location.href = this.url("api/sonos/login");
	}

	disconnect(): void {
		if (this.cast()) this.output.stop();
		this.forget();
	}

	canPlay(track: QueuedTrack): boolean {
		return !!this.source?.canPlay(track) && !!contentType(track.name);
	}

	async loadGroups(): Promise<void> {
		this.groups.set(null);
		this.groupsFailed.set(false);
		try {
			const { groups } = await this.request<{ groups: SonosGroup[] }>("GET", "api/sonos/groups");
			this.groups.set(groups);
		} catch {
			this.groupsFailed.set(true);
		}
	}

	async start(group: SonosGroup): Promise<boolean> {
		const queue = this.player.queue();
		const pos = this.playableFrom(queue.pos);
		if (pos === null) {
			this.notice.set("nothingPlayable");
			return false;
		}
		const current = this.cast();
		if (current) {
			await this.control({ action: "pause" }).catch(() => {});
			this.finish();
		}
		try {
			await this.resolveUrls(pos);
			const items = this.items();
			const itemId = this.itemAt(pos)!;
			const startAt = pos === queue.pos ? this.player.time() : 0;
			const result = await this.request<{ id: string; key: string }>("POST", "api/sonos/queues", {
				groupId: group.id,
				items,
				itemId,
				positionMillis: Math.round(startAt * 1000),
				play: true,
			});
			this.uploaded = JSON.stringify(items);
			this.cast.set({ id: result.id, key: result.key, group });
			this.player.setExternal(this.output);
			this.last = null;
			this.wasPlaying = false;
			this.player.updateExternal({ pos, time: startAt, playing: false, loading: true });
			this.schedulePoll(1000);
			this.tickTimer = window.setInterval(() => this.tick(), TICK);
			return true;
		} catch (error) {
			if (!(error instanceof SonosRequestError && error.status === 401)) this.notice.set("error");
			return false;
		}
	}

	async playHere(): Promise<void> {
		if (!this.cast()) return;
		await this.control({ action: "pause" }).catch(() => {});
		await this.poll().catch(() => {});
		this.finish();
		this.player.toggle();
	}

	private url(path: string): string {
		return new URL(path, document.baseURI).href;
	}

	private forget(): void {
		this.finish();
		this.token = null;
		writeToken(null);
		this.connected.set(false);
		this.groups.set(null);
	}

	private async request<T>(method: string, path: string, body?: unknown, queueKey?: string): Promise<T> {
		const headers: Record<string, string> = {};
		if (this.token) headers["X-Sonos-Token"] = this.token;
		if (queueKey) headers["X-Queue-Key"] = queueKey;
		if (body !== undefined) headers["Content-Type"] = "application/json";
		const response = await fetch(this.url(path), {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		const fresh = response.headers.get("X-Sonos-Token");
		if (fresh) {
			this.token = fresh;
			writeToken(fresh);
		}
		const text = await response.text();
		const data = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T & { error?: string });
		if (!response.ok) {
			if (response.status === 401 && data.error === "reconnect") {
				this.forget();
				this.notice.set("reconnect");
			}
			throw new SonosRequestError(response.status, data.error ?? response.statusText);
		}
		return data;
	}

	private control(body: { action: string; itemId?: string; positionMillis?: number; play?: boolean }) {
		const cast = this.cast();
		if (!cast) return Promise.resolve();
		this.schedulePoll(800);
		return this.request("POST", `api/sonos/queues/${cast.id}/control`, body, cast.key).then(
			() => this.schedulePoll(800),
			(error) => this.failed(error),
		);
	}

	private failed(error: unknown): void {
		if (error instanceof SonosRequestError && (error.status === 410 || error.status === 404)) {
			this.finish();
			this.notice.set("lost");
		} else if (!(error instanceof SonosRequestError && error.status === 401)) {
			this.notice.set("error");
		}
	}

	private idOf(track: QueuedTrack): string {
		let id = this.ids.get(track);
		if (!id) {
			id = `${this.prefix}-${++this.counter}`;
			this.ids.set(track, id);
		}
		return id;
	}

	private trackAt(pos: number): QueuedTrack | null {
		const index = this.player.queue().order[pos];
		return index === undefined ? null : (this.player.tracks()[index] ?? null);
	}

	private itemAt(pos: number): string | null {
		const track = this.trackAt(pos);
		return track && this.canPlay(track) ? this.idOf(track) : null;
	}

	private playableFrom(pos: number): number | null {
		const length = this.player.queue().order.length;
		for (let p = Math.max(0, pos); p < length; p++) if (this.itemAt(p)) return p;
		return null;
	}

	private items(): Item[] {
		const order = this.player.queue().order;
		const items: Item[] = [];
		for (let pos = 0; pos < order.length; pos++) {
			const track = this.trackAt(pos);
			if (!track || !this.canPlay(track)) continue;
			const id = this.idOf(track);
			const cached = this.urls.get(id);
			items.push({
				id,
				title: track.title,
				...(track.artist ? { artist: track.artist } : {}),
				...(track.album ? { album: track.album } : {}),
				duration: track.duration,
				type: contentType(track.name)!,
				url: cached && Date.now() - cached.at < URL_FRESH + 15 * 60 * 1000 ? cached.url : null,
			});
		}
		return items;
	}

	private staleAround(pos: number): QueuedTrack[] {
		const stale: QueuedTrack[] = [];
		const length = this.player.queue().order.length;
		for (let p = Math.max(0, pos - URL_BEHIND); p < Math.min(length, pos + URL_AHEAD); p++) {
			const track = this.trackAt(p);
			if (!track || !this.canPlay(track)) continue;
			const cached = this.urls.get(this.idOf(track));
			if (!cached || Date.now() - cached.at > URL_FRESH) stale.push(track);
		}
		return stale;
	}

	private async resolveUrls(pos: number): Promise<void> {
		const stale = this.staleAround(pos);
		const work = stale.map((track) => async () => {
			try {
				const url = await this.source?.streamUrl(track);
				if (url) this.urls.set(this.idOf(track), { url, at: Date.now() });
			} catch (error) {
				console.error(error);
			}
		});
		const run = async () => {
			for (let next = work.shift(); next; next = work.shift()) await next();
		};
		await Promise.all([run(), run(), run(), run()]);
	}

	private scheduleSync(): void {
		clearTimeout(this.syncTimer);
		this.syncTimer = window.setTimeout(() => void this.sync(), 300);
	}

	private sync(): Promise<void> {
		this.syncing = this.syncing.then(() => this.upload()).catch((error) => this.failed(error));
		return this.syncing;
	}

	private async upload(): Promise<void> {
		const cast = this.cast();
		if (!cast) return;
		await this.resolveUrls(this.player.queue().pos);
		if (this.cast() !== cast) return;
		const items = this.items();
		const json = JSON.stringify(items);
		if (json === this.uploaded) return;
		await this.request("PUT", `api/sonos/queues/${cast.id}`, { items }, cast.key);
		this.uploaded = json;
	}

	private async load(pos: number, startAt: number, play: boolean): Promise<void> {
		clearTimeout(this.syncTimer);
		await this.sync();
		const target = this.playableFrom(pos);
		if (target === null) {
			this.player.updateExternal({ pos, time: 0, playing: false, loading: false });
			return;
		}
		const itemId = this.itemAt(target)!;
		this.last = null;
		this.wasPlaying = false;
		if (target !== pos) this.player.updateExternal({ pos: target, time: 0, playing: false, loading: true });
		await this.control({
			action: "skipToItem",
			itemId,
			positionMillis: target === pos ? Math.round(startAt * 1000) : 0,
			play,
		});
	}

	private schedulePoll(delay = POLL): void {
		if (!this.cast()) return;
		clearTimeout(this.pollTimer);
		this.pollTimer = window.setTimeout(() => {
			void this.poll()
				.catch((error) => {
					if (error instanceof SonosRequestError && (error.status === 410 || error.status === 404)) {
						this.finish();
						this.notice.set("lost");
					}
				})
				.finally(() => this.schedulePoll());
		}, delay);
	}

	private async poll(): Promise<void> {
		const cast = this.cast();
		if (!cast) return;
		const status = await this.request<Status>("GET", `api/sonos/queues/${cast.id}/status`, undefined, cast.key);
		if (this.cast() !== cast) return;
		const ours = !!status.itemId?.startsWith(`${this.prefix}-`);
		if (status.itemId && !ours && status.state !== "PLAYBACK_STATE_IDLE") {
			this.finish();
			this.notice.set("evicted");
			return;
		}
		const order = this.player.queue().order;
		let pos = this.player.queue().pos;
		if (ours) {
			const found = order.findIndex((_, p) => this.itemAt(p) === status.itemId);
			if (found >= 0) pos = found;
		}
		const playing = status.state === "PLAYBACK_STATE_PLAYING";
		const loading = status.state === "PLAYBACK_STATE_BUFFERING";
		this.last = { status, at: Date.now(), pos };
		this.player.updateExternal({ pos, time: status.positionMillis / 1000, playing, loading });
		if (status.state === "PLAYBACK_STATE_IDLE" && this.wasPlaying && this.playableFrom(pos + 1) === null) {
			this.wasPlaying = false;
			this.player.externalEnded();
		} else if (playing || loading) {
			this.wasPlaying = true;
		}
		if (this.staleAround(pos).length) this.scheduleSync();
	}

	private tick(): void {
		const last = this.last;
		if (!last || last.status.state !== "PLAYBACK_STATE_PLAYING" || !this.cast()) return;
		if (this.player.queue().pos !== last.pos) return;
		const time = last.status.positionMillis / 1000 + (Date.now() - last.at) / 1000;
		const duration = this.player.duration();
		this.player.updateExternal({
			pos: last.pos,
			time: duration ? Math.min(time, duration) : time,
			playing: true,
			loading: false,
		});
	}

	private finish(): void {
		const cast = this.cast();
		clearTimeout(this.pollTimer);
		clearTimeout(this.syncTimer);
		clearInterval(this.tickTimer);
		this.last = null;
		if (!cast) return;
		this.cast.set(null);
		this.uploaded = "";
		this.player.setExternal(null);
		void this.request("DELETE", `api/sonos/queues/${cast.id}`, undefined, cast.key).catch(() => {});
	}
}
