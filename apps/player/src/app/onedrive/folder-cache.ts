import { idbClear, idbGet, idbSet } from "../storage/idb";
import { DriveItem } from "./items";

const key = (folderId: string | null) => folderId ?? "root";

export async function cachedChildren(folderId: string | null): Promise<DriveItem[] | null> {
	const value = await idbGet<DriveItem[]>("folders", key(folderId));
	return Array.isArray(value) ? value : null;
}

export async function cacheChildren(folderId: string | null, items: DriveItem[]): Promise<void> {
	await idbSet("folders", key(folderId), items);
}

export async function clearCache(): Promise<void> {
	await idbClear("folders");
}
