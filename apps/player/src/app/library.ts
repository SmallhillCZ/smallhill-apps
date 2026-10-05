import { Folder } from "./onedrive/items";

export type SourceId = "onedrive" | "device";
export const SOURCES: SourceId[] = ["onedrive", "device"];

export interface Library {
	source: SourceId;
	path: Folder[];
	root?: string;
}

export type Paths = Record<SourceId, Folder[]>;

const PATH_KEY = "player.path";
const LIBRARY_KEY = "player.library";
const SOURCE_KEY = "player.source";

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

const isSource = (value: unknown): value is SourceId => SOURCES.includes(value as SourceId);

export function loadLibrary(): Library | null {
	const stored = read(LIBRARY_KEY) as Partial<Library> | unknown[] | null;
	if (Array.isArray(stored)) return { source: "onedrive", path: toFolders(stored)! };
	if (stored && isSource(stored.source)) {
		const library: Library = { source: stored.source, path: toFolders(stored.path) ?? [] };
		if (typeof stored.root === "string") library.root = stored.root;
		return library;
	}
	return null;
}

export function saveLibrary(library: Library | null): void {
	write(LIBRARY_KEY, library);
}

export function loadPaths(): Paths {
	const stored = read(PATH_KEY) as Partial<Paths> | unknown[] | null;
	if (Array.isArray(stored)) return { onedrive: toFolders(stored)!, device: [] };
	return { onedrive: toFolders(stored?.onedrive) ?? [], device: toFolders(stored?.device) ?? [] };
}

export function savePaths(paths: Paths): void {
	write(PATH_KEY, paths);
}

export function loadSource(): SourceId {
	const stored = read(SOURCE_KEY);
	return isSource(stored) ? stored : "onedrive";
}

export function saveSource(source: SourceId): void {
	write(SOURCE_KEY, source);
}

export const samePath = (a: Folder[], b: Folder[]) =>
	a.length === b.length && a.every((folder, i) => folder.id === b[i].id);
