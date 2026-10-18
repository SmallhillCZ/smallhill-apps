import { Injectable, computed, signal } from "@angular/core";

export interface Place {
	name: string;
	address: string | null;
	note: string | null;
	lat: number;
	lng: number;
	placeId: string | null;
	cid: string | null;
}

export interface PlaceList {
	id: string;
	token: string | null;
	title: string;
	description: string | null;
	places: Place[];
}

export interface SavedList {
	url: string;
	color: string;
	visible: boolean;
	data: PlaceList | null;
	savedAt: string | null;
}

export type ListError = "url" | "notfound" | "google" | "offline" | "duplicate";

export class ListFailure extends Error {
	readonly kind: ListError;
	constructor(kind: ListError) {
		super(kind);
		this.kind = kind;
	}
}

export const COLORS = ["#0c8599", "#e8590c", "#7048e8", "#2f9e44", "#c2255c", "#1971c2", "#f08c00", "#495057"];
export const MAPSETS = ["outdoor", "basic", "aerial", "winter"] as const;
export type Mapset = (typeof MAPSETS)[number];

const LISTS_KEY = "places.lists";
const MAPSET_KEY = "places.mapset";

function read<T>(key: string): T | null {
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : null;
	} catch {
		return null;
	}
}

function write(key: string, value: unknown) {
	try {
		localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
	} catch {}
}

@Injectable({ providedIn: "root" })
export class Lists {
	readonly lists = signal<SavedList[]>(read<SavedList[]>(LISTS_KEY) ?? []);
	readonly loading = signal<ReadonlySet<string>>(new Set());
	readonly errors = signal<Readonly<Record<string, ListError>>>({});
	readonly mapset = signal<Mapset>(
		(MAPSETS as readonly string[]).includes(read<string>(MAPSET_KEY) ?? "")
			? (read<string>(MAPSET_KEY) as Mapset)
			: "outdoor",
	);
	readonly visiblePlaces = computed(() =>
		this.lists()
			.filter((l) => l.visible && l.data)
			.flatMap((l) => l.data!.places.map((place) => ({ place, list: l }))),
	);

	setMapset(mapset: Mapset) {
		this.mapset.set(mapset);
		write(MAPSET_KEY, JSON.stringify(mapset));
	}

	async add(url: string, lang: string): Promise<SavedList> {
		const trimmed = url.trim();
		if (this.lists().some((l) => l.url === trimmed)) throw new ListFailure("duplicate");
		const data = await this.fetchList(trimmed, lang);
		if (this.lists().some((l) => l.data?.id === data.id)) throw new ListFailure("duplicate");
		const used = new Set(this.lists().map((l) => l.color));
		const color = COLORS.find((c) => !used.has(c)) ?? COLORS[this.lists().length % COLORS.length];
		const saved: SavedList = { url: trimmed, color, visible: true, data, savedAt: new Date().toISOString() };
		this.update((lists) => [...lists, saved]);
		return saved;
	}

	async refresh(url: string, lang: string) {
		this.setLoading(url, true);
		try {
			const data = await this.fetchList(url, lang);
			this.patch(url, { data, savedAt: new Date().toISOString() });
			this.setError(url, null);
		} catch (err) {
			this.setError(url, err instanceof ListFailure ? err.kind : "google");
		} finally {
			this.setLoading(url, false);
		}
	}

	refreshAll(lang: string) {
		return Promise.all(this.lists().map((l) => this.refresh(l.url, lang)));
	}

	remove(url: string) {
		this.update((lists) => lists.filter((l) => l.url !== url));
		this.setError(url, null);
	}

	toggle(url: string) {
		const list = this.lists().find((l) => l.url === url);
		if (list) this.patch(url, { visible: !list.visible });
	}

	nextColor(url: string) {
		const list = this.lists().find((l) => l.url === url);
		if (!list) return;
		this.patch(url, { color: COLORS[(COLORS.indexOf(list.color) + 1) % COLORS.length] });
	}

	private async fetchList(url: string, lang: string): Promise<PlaceList> {
		let res: Response;
		try {
			res = await fetch(`api/list?url=${encodeURIComponent(url)}&lang=${lang}`);
		} catch {
			throw new ListFailure("offline");
		}
		if (res.ok) return (await res.json()) as PlaceList;
		const body = (await res.json().catch(() => ({}))) as { error?: string };
		if (body.error === "url" || body.error === "notfound") throw new ListFailure(body.error);
		throw new ListFailure("google");
	}

	private patch(url: string, change: Partial<SavedList>) {
		this.update((lists) => lists.map((l) => (l.url === url ? { ...l, ...change } : l)));
	}

	private update(fn: (lists: SavedList[]) => SavedList[]) {
		this.lists.update(fn);
		write(LISTS_KEY, this.lists());
	}

	private setLoading(url: string, on: boolean) {
		const next = new Set(this.loading());
		if (on) next.add(url);
		else next.delete(url);
		this.loading.set(next);
	}

	private setError(url: string, kind: ListError | null) {
		const next = { ...this.errors() };
		if (kind) next[url] = kind;
		else delete next[url];
		this.errors.set(next);
	}
}
