import { Folder } from "./onedrive/items";

export type SourceKind = "onedrive" | "device";

export interface Source {
	id: string;
	kind: SourceKind;
	name: string;
	account?: string;
	root?: Folder[];
}

const SOURCES_KEY = "player.sources";
const LOCATION_KEY = "player.location";

function read(key: string): unknown {
	try {
		return JSON.parse(localStorage.getItem(key) ?? "null");
	} catch {
		return null;
	}
}

function write(key: string, value: unknown): void {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, JSON.stringify(value));
	} catch {}
}

export function toFolders(value: unknown): Folder[] | null {
	return Array.isArray(value) ? value.filter((f) => typeof f?.id === "string" && typeof f?.name === "string") : null;
}

function isSource(value: unknown): value is Source {
	const source = value as Partial<Source> | null;
	return (
		!!source &&
		typeof source.id === "string" &&
		typeof source.name === "string" &&
		(source.kind === "onedrive" || source.kind === "device") &&
		(source.account === undefined || typeof source.account === "string") &&
		(source.root === undefined || toFolders(source.root)?.length === source.root.length)
	);
}

export function loadSources(): Source[] | null {
	const stored = read(SOURCES_KEY);
	return Array.isArray(stored) ? stored.filter(isSource) : null;
}

export function saveSources(sources: Source[]): void {
	write(SOURCES_KEY, sources);
}

export function loadLocation(): Folder[] {
	return toFolders(read(LOCATION_KEY)) ?? [];
}

export function saveLocation(path: Folder[]): void {
	write(LOCATION_KEY, path);
}

export function withRenamedRoot(path: Folder[], sources: Source[]): Folder[] {
	const source = sources.find((s) => s.id === path[0]?.id);
	return source && path[0].name !== source.name ? [{ ...path[0], name: source.name }, ...path.slice(1)] : path;
}

export const rootLabel = (source: Source) => source.root?.map((folder) => folder.name).join(" / ") ?? "";
