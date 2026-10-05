const DB_NAME = "player";
export type StoreName = "folders" | "handles";
const STORES: StoreName[] = ["folders", "handles"];

let db: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
	db ??= new Promise((resolve) => {
		try {
			const request = indexedDB.open(DB_NAME, 2);
			request.onupgradeneeded = () => {
				for (const store of STORES) {
					if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
				}
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
	return db;
}

async function run<T>(
	name: StoreName,
	mode: IDBTransactionMode,
	action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
	const database = await open();
	if (!database) return null;
	return new Promise((resolve) => {
		try {
			const request = action(database.transaction(name, mode).objectStore(name));
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
}

export async function idbGet<T>(store: StoreName, key: string): Promise<T | null> {
	return ((await run(store, "readonly", (s) => s.get(key))) as T | undefined) ?? null;
}

export async function idbSet(store: StoreName, key: string, value: unknown): Promise<void> {
	await run(store, "readwrite", (s) => s.put(value, key));
}

export async function idbDelete(store: StoreName, key: string): Promise<void> {
	await run(store, "readwrite", (s) => s.delete(key));
}

export async function idbClear(store: StoreName): Promise<void> {
	await run(store, "readwrite", (s) => s.clear());
}
