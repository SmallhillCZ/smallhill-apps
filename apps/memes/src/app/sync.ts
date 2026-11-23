import type { Meme, MemeMeta } from "./library";

export type SyncedMeta = MemeMeta & { updated: number };

export interface RemoteIndex {
	version: 1;
	memes: SyncedMeta[];
	deleted: Record<string, number>;
}

export interface RemoteState {
	index: RemoteIndex | null;
	etag: string | null;
}

export interface Drive {
	readIndex(): Promise<RemoteState>;
	writeIndex(index: RemoteIndex, etag: string | null): Promise<"ok" | "conflict">;
	upload(meme: SyncedMeta, blob: Blob): Promise<void>;
	download(meme: SyncedMeta): Promise<Blob>;
	remove(meme: SyncedMeta): Promise<void>;
}

export interface LocalLibrary {
	all(): Promise<Meme[]>;
	deleted(): Record<string, number>;
	put(memes: Meme[]): Promise<void>;
	remove(ids: string[]): Promise<void>;
}

export interface SyncPlan {
	index: RemoteIndex;
	download: SyncedMeta[];
	applyMeta: SyncedMeta[];
	upload: SyncedMeta[];
	deleteLocal: string[];
	deleteRemote: SyncedMeta[];
}

const META_KEYS = ["id", "type", "name", "title", "tags", "added", "used", "uses", "updated"] as const;

export function updatedOf(meme: MemeMeta): number {
	return meme.updated ?? meme.added;
}

export function toMeta(meme: MemeMeta): SyncedMeta {
	const meta = {} as Record<string, unknown>;
	for (const key of META_KEYS) meta[key] = key === "updated" ? updatedOf(meme) : meme[key];
	return meta as unknown as SyncedMeta;
}

function sameMeta(a: SyncedMeta, b: SyncedMeta): boolean {
	return META_KEYS.every((key) => JSON.stringify(a[key]) === JSON.stringify(b[key]));
}

export function planSync(
	local: MemeMeta[],
	localDeleted: Record<string, number>,
	remote: RemoteIndex | null,
): SyncPlan {
	const plan: SyncPlan = {
		index: { version: 1, memes: [], deleted: {} },
		download: [],
		applyMeta: [],
		upload: [],
		deleteLocal: [],
		deleteRemote: [],
	};
	const localById = new Map(local.map((m) => [m.id, toMeta(m)]));
	const remoteById = new Map((remote?.memes ?? []).map((m) => [m.id, toMeta(m)]));
	const remoteDeleted = remote?.deleted ?? {};
	const ids = new Set([
		...localById.keys(),
		...remoteById.keys(),
		...Object.keys(localDeleted),
		...Object.keys(remoteDeleted),
	]);
	for (const id of ids) {
		const l = localById.get(id);
		const r = remoteById.get(id);
		const tombs = [localDeleted[id], remoteDeleted[id]].filter((t): t is number => typeof t === "number");
		const deleted = tombs.length ? Math.max(...tombs) : undefined;
		const winner = l && r ? (r.updated > l.updated ? r : l) : (l ?? r);
		if (deleted !== undefined && (!winner || deleted >= winner.updated)) {
			plan.index.deleted[id] = deleted;
			if (l) plan.deleteLocal.push(id);
			if (r) plan.deleteRemote.push(r);
			continue;
		}
		if (!winner) continue;
		plan.index.memes.push(winner);
		if (!l) plan.download.push(winner);
		else if (!r) plan.upload.push(l);
		else if (winner === r && !sameMeta(l, r)) plan.applyMeta.push(r);
	}
	plan.index.memes.sort((a, b) => a.added - b.added || a.id.localeCompare(b.id));
	return plan;
}

export interface SyncResult {
	downloaded: number;
	uploaded: number;
	deleted: number;
	changed: boolean;
}

export async function runSync(local: LocalLibrary, drive: Drive, attempts = 3): Promise<SyncResult> {
	for (let attempt = 1; ; attempt++) {
		const remote = await drive.readIndex();
		const memes = await local.all();
		const plan = planSync(memes, local.deleted(), remote.index);
		const blobs = new Map(memes.map((m) => [m.id, m.blob]));
		for (const meta of plan.upload) await drive.upload(meta, blobs.get(meta.id)!);
		const changed =
			!remote.index ||
			plan.upload.length > 0 ||
			JSON.stringify(remote.index.memes) !== JSON.stringify(plan.index.memes) ||
			JSON.stringify(sortKeys(remote.index.deleted)) !== JSON.stringify(sortKeys(plan.index.deleted));
		if (changed) {
			const written = await drive.writeIndex(plan.index, remote.etag);
			if (written === "conflict") {
				if (attempt >= attempts) throw new Error("sync conflict");
				continue;
			}
		}
		const downloaded: Meme[] = [];
		for (const meta of plan.download) {
			try {
				downloaded.push({ ...meta, blob: await drive.download(meta) });
			} catch (error) {
				console.error(error);
			}
		}
		const metaOnly = plan.applyMeta.map((meta) => ({ ...meta, blob: blobs.get(meta.id)! }));
		if (downloaded.length || metaOnly.length) await local.put([...downloaded, ...metaOnly]);
		if (plan.deleteLocal.length) await local.remove(plan.deleteLocal);
		for (const meta of plan.deleteRemote) {
			try {
				await drive.remove(meta);
			} catch (error) {
				console.error(error);
			}
		}
		return {
			downloaded: downloaded.length,
			uploaded: plan.upload.length,
			deleted: plan.deleteLocal.length,
			changed: downloaded.length + metaOnly.length + plan.deleteLocal.length > 0,
		};
	}
}

function sortKeys(record: Record<string, number>): [string, number][] {
	return Object.entries(record).sort(([a], [b]) => a.localeCompare(b));
}
