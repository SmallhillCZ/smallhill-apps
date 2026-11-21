import type { Meme } from "./library";

const DB_NAME = "memes";
const STORE = "memes";

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
	opening ??= new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(STORE))
				request.result.createObjectStore(STORE, { keyPath: "id" });
		};
		request.onsuccess = () => {
			const db = request.result;
			db.onversionchange = () => {
				db.close();
				opening = null;
			};
			resolve(db);
		};
		request.onerror = () => {
			opening = null;
			reject(request.error);
		};
	});
	return opening;
}

function done<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
	return (await open()).transaction(STORE, mode).objectStore(STORE);
}

export async function getAll(): Promise<Meme[]> {
	return done((await store("readonly")).getAll() as IDBRequest<Meme[]>);
}

export async function get(id: string): Promise<Meme | undefined> {
	return done((await store("readonly")).get(id) as IDBRequest<Meme | undefined>);
}

export async function putAll(memes: Meme[]): Promise<void> {
	const db = await open();
	await new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		const target = tx.objectStore(STORE);
		for (const meme of memes) target.put(meme);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error);
	});
}

export async function remove(id: string): Promise<void> {
	await done((await store("readwrite")).delete(id));
}
