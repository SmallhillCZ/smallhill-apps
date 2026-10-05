import { DriveItem } from "./items";

const DB_NAME = "player";
const STORE = "folders";

let db: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
	db ??= new Promise((resolve) => {
		try {
			const request = indexedDB.open(DB_NAME, 1);
			request.onupgradeneeded = () => request.result.createObjectStore(STORE);
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
	return db;
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
	const database = await open();
	if (!database) return null;
	return new Promise((resolve) => {
		try {
			const request = action(database.transaction(STORE, mode).objectStore(STORE));
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
}

const key = (folderId: string | null) => folderId ?? "root";

export async function cachedChildren(folderId: string | null): Promise<DriveItem[] | null> {
	const value = await run<DriveItem[] | undefined>("readonly", (store) => store.get(key(folderId)));
	return Array.isArray(value) ? value : null;
}

export async function cacheChildren(folderId: string | null, items: DriveItem[]): Promise<void> {
	await run("readwrite", (store) => store.put(items, key(folderId)));
}

export async function clearCache(): Promise<void> {
	await run("readwrite", (store) => store.clear());
}
