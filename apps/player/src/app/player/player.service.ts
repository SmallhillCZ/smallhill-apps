import { computed, effect, inject, Injectable, signal } from "@angular/core";
import { Track } from "../onedrive/items";
import { OneDriveService } from "../onedrive/onedrive.service";
import { createQueue, nextPos, prevPos, Queue, Repeat, reshuffle } from "./queue";

const STORAGE_KEY = "player.settings";
const URL_TTL = 45 * 60 * 1000;
const REPEATS: Repeat[] = ["off", "all", "one"];

interface Settings {
	shuffle: boolean;
	repeat: Repeat;
}

function loadSettings(): Settings {
	try {
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Settings>;
		return { shuffle: stored.shuffle === true, repeat: REPEATS.includes(stored.repeat!) ? stored.repeat! : "off" };
	} catch {
		return { shuffle: false, repeat: "off" };
	}
}

@Injectable({ providedIn: "root" })
export class PlayerService {
	private readonly drive = inject(OneDriveService);
	private readonly audio = new Audio();
	private readonly urls = new Map<string, { url: string; at: number }>();
	private request = 0;
	private retried = false;

	private readonly settings = loadSettings();
	readonly tracks = signal<Track[]>([]);
	readonly queue = signal<Queue>({ order: [], pos: 0 });
	readonly shuffle = signal(this.settings.shuffle);
	readonly repeat = signal<Repeat>(this.settings.repeat);
	readonly playing = signal(false);
	readonly loading = signal(false);
	readonly error = signal(false);
	readonly time = signal(0);
	readonly duration = signal<number | null>(null);

	readonly current = computed(() => {
		const queue = this.queue();
		const index = queue.order[queue.pos];
		return index === undefined ? null : (this.tracks()[index] ?? null);
	});

	constructor() {
		this.audio.preload = "auto";
		this.audio.addEventListener("playing", () => {
			this.playing.set(true);
			this.loading.set(false);
		});
		this.audio.addEventListener("pause", () => this.playing.set(false));
		this.audio.addEventListener("waiting", () => this.loading.set(true));
		this.audio.addEventListener("timeupdate", () => {
			this.time.set(this.audio.currentTime);
			this.updatePosition();
		});
		this.audio.addEventListener("durationchange", () => {
			const duration = this.audio.duration;
			this.duration.set(isFinite(duration) ? duration : (this.current()?.duration ?? null));
			this.updatePosition();
		});
		this.audio.addEventListener("ended", () => this.next(true));
		this.audio.addEventListener("error", () => {
			const track = this.current();
			if (!track || !this.audio.getAttribute("src")) return;
			if (!this.retried) {
				this.retried = true;
				this.urls.delete(track.id);
				void this.load(this.time());
				return;
			}
			this.loading.set(false);
			this.playing.set(false);
			this.error.set(true);
		});

		effect(() => {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify({ shuffle: this.shuffle(), repeat: this.repeat() }));
			} catch {}
		});
		effect(() => this.updateMetadata(this.current()));
		effect(() => {
			if ("mediaSession" in navigator)
				navigator.mediaSession.playbackState = this.playing() ? "playing" : "paused";
		});
		this.setupMediaSession();
	}

	playList(tracks: Track[], start: number): void {
		this.tracks.set(tracks);
		this.queue.set(createQueue(tracks.length, start, this.shuffle()));
		void this.load();
	}

	toggle(): void {
		if (!this.current()) return;
		if (this.audio.paused) {
			if (this.error() || !this.audio.getAttribute("src")) void this.load(this.time());
			else void this.audio.play().catch(() => this.playing.set(false));
		} else {
			this.audio.pause();
		}
	}

	next(auto = false): void {
		const pos = nextPos(this.queue(), this.repeat(), auto);
		if (pos === null) {
			if (auto) this.playing.set(false);
			return;
		}
		this.queue.update((queue) => ({ ...queue, pos }));
		void this.load();
	}

	prev(): void {
		if (this.audio.currentTime > 3) {
			this.seek(0);
			return;
		}
		const pos = prevPos(this.queue(), this.repeat());
		if (pos === null) {
			this.seek(0);
			return;
		}
		this.queue.update((queue) => ({ ...queue, pos }));
		void this.load();
	}

	seek(seconds: number): void {
		if (!this.audio.getAttribute("src")) return;
		this.audio.currentTime = Math.max(0, seconds);
		this.time.set(this.audio.currentTime);
	}

	toggleShuffle(): void {
		this.shuffle.update((value) => !value);
		if (this.current()) this.queue.update((queue) => reshuffle(queue, this.shuffle()));
	}

	cycleRepeat(): void {
		this.repeat.update((value) => REPEATS[(REPEATS.indexOf(value) + 1) % REPEATS.length]);
	}

	stop(): void {
		this.request++;
		this.audio.pause();
		this.audio.removeAttribute("src");
		this.audio.load();
		this.tracks.set([]);
		this.queue.set({ order: [], pos: 0 });
		this.time.set(0);
		this.duration.set(null);
		this.error.set(false);
		this.loading.set(false);
	}

	private async load(startAt = 0): Promise<void> {
		const track = this.current();
		if (!track) return;
		const request = ++this.request;
		if (startAt === 0) this.retried = false;
		this.loading.set(true);
		this.error.set(false);
		this.time.set(startAt);
		this.duration.set(track.duration);
		try {
			const url = this.cached(track.id) ?? (await this.fetchUrl(track.id));
			if (request !== this.request) return;
			this.audio.src = url;
			if (startAt) this.audio.currentTime = startAt;
			await this.audio.play();
			this.prefetchNext();
		} catch (error) {
			if (request !== this.request) return;
			this.loading.set(false);
			this.playing.set(false);
			if ((error as DOMException)?.name !== "NotAllowedError" && (error as DOMException)?.name !== "AbortError") {
				this.error.set(true);
			}
		}
	}

	private cached(id: string): string | null {
		const entry = this.urls.get(id);
		return entry && Date.now() - entry.at < URL_TTL ? entry.url : null;
	}

	private async fetchUrl(id: string): Promise<string> {
		const url = await this.drive.downloadUrl(id);
		this.urls.set(id, { url, at: Date.now() });
		return url;
	}

	private prefetchNext(): void {
		const queue = this.queue();
		const pos = nextPos(queue, this.repeat(), true);
		const track = pos === null ? null : this.tracks()[queue.order[pos]];
		if (track && !this.cached(track.id)) void this.fetchUrl(track.id).catch(() => {});
	}

	private setupMediaSession(): void {
		if (!("mediaSession" in navigator)) return;
		const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
			["play", () => this.toggle()],
			["pause", () => this.audio.pause()],
			["previoustrack", () => this.prev()],
			["nexttrack", () => this.next()],
			["seekbackward", (details) => this.seek(this.audio.currentTime - (details.seekOffset ?? 10))],
			["seekforward", (details) => this.seek(this.audio.currentTime + (details.seekOffset ?? 10))],
			["seekto", (details) => this.seek(details.seekTime ?? 0)],
		];
		for (const [action, handler] of handlers) {
			try {
				navigator.mediaSession.setActionHandler(action, handler);
			} catch {}
		}
	}

	private updateMetadata(track: Track | null): void {
		if (!("mediaSession" in navigator)) return;
		navigator.mediaSession.metadata = track
			? new MediaMetadata({
					title: track.title,
					artist: track.artist,
					album: track.album,
					artwork: [
						{
							src: new URL("icons/icon-512x512.png", document.baseURI).href,
							sizes: "512x512",
							type: "image/png",
						},
					],
				})
			: null;
	}

	private updatePosition(): void {
		if (!("mediaSession" in navigator) || !navigator.mediaSession.setPositionState) return;
		const duration = this.audio.duration;
		if (!isFinite(duration) || duration <= 0) return;
		try {
			navigator.mediaSession.setPositionState({
				duration,
				position: Math.min(this.audio.currentTime, duration),
				playbackRate: this.audio.playbackRate,
			});
		} catch {}
	}
}
