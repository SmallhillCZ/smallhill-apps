const DB = "release-line";
const STORE = "repos";
const MAX_AGE = 14 * 24 * 60 * 60 * 1000;

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	const db = await open();
	try {
		return await new Promise<T>((resolve, reject) => {
			const req = fn(db.transaction(STORE, mode).objectStore(STORE));
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
	} finally {
		db.close();
	}
}

export async function cached<T>(repo: string, key: string): Promise<T | null> {
	try {
		const entry = await run<{ key: string; at: number; value: T } | undefined>("readonly", (s) => s.get(repo));
		return entry && entry.key === key && Date.now() - entry.at < MAX_AGE ? entry.value : null;
	} catch {
		return null;
	}
}

export async function cache(repo: string, key: string, value: unknown) {
	try {
		await run("readwrite", (s) => s.put({ key, at: Date.now(), value }, repo));
	} catch {}
}

export async function clearCache() {
	try {
		await run("readwrite", (s) => s.clear());
	} catch {}
}
