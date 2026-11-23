import assert from "node:assert/strict";
import { test } from "node:test";
import type { Meme } from "../src/app/library.ts";
import { type Drive, type LocalLibrary, type RemoteIndex, planSync, runSync, toMeta } from "../src/app/sync.ts";

function meme(id: string, overrides: Partial<Meme> = {}): Meme {
	return {
		id,
		type: "image/png",
		name: `${id}.png`,
		title: id,
		tags: [],
		added: 1,
		used: 0,
		uses: 0,
		blob: new Blob([id], { type: "image/png" }),
		...overrides,
	};
}

class FakeDrive implements Drive {
	index: RemoteIndex | null = null;
	etag = 0;
	files = new Map<string, Blob>();
	writes = 0;
	conflictOnce = false;

	async readIndex() {
		return { index: this.index && structuredClone(this.index), etag: this.index ? String(this.etag) : null };
	}
	async writeIndex(index: RemoteIndex, etag: string | null) {
		if (this.conflictOnce) {
			this.conflictOnce = false;
			this.etag++;
			return "conflict" as const;
		}
		if ((this.index ? String(this.etag) : null) !== etag) return "conflict" as const;
		this.index = structuredClone(index);
		this.etag++;
		this.writes++;
		return "ok" as const;
	}
	async upload(meta: { id: string }, blob: Blob) {
		this.files.set(meta.id, blob);
	}
	async download(meta: { id: string }) {
		const blob = this.files.get(meta.id);
		if (!blob) throw new Error("missing");
		return blob;
	}
	async remove(meta: { id: string }) {
		this.files.delete(meta.id);
	}
}

class Device implements LocalLibrary {
	memes = new Map<string, Meme>();
	tombs: Record<string, number> = {};
	constructor(...memes: Meme[]) {
		for (const m of memes) this.memes.set(m.id, m);
	}
	async all() {
		return [...this.memes.values()];
	}
	deleted() {
		return this.tombs;
	}
	async put(memes: Meme[]) {
		for (const m of memes) this.memes.set(m.id, m);
	}
	async remove(ids: string[]) {
		for (const id of ids) this.memes.delete(id);
	}
	delete(id: string, at: number) {
		this.memes.delete(id);
		this.tombs[id] = at;
	}
}

test("two devices end up with the same library", async () => {
	const drive = new FakeDrive();
	const phone = new Device(meme("a"), meme("b"));
	const laptop = new Device(meme("c"));
	await runSync(phone, drive);
	const result = await runSync(laptop, drive);
	assert.equal(result.downloaded, 2);
	assert.equal(result.uploaded, 1);
	await runSync(phone, drive);
	assert.deepEqual([...phone.memes.keys()].sort(), ["a", "b", "c"]);
	assert.deepEqual([...laptop.memes.keys()].sort(), ["a", "b", "c"]);
	assert.equal(await (await laptop.memes.get("a")!.blob).text(), "a");
	const writes = drive.writes;
	await runSync(phone, drive);
	assert.equal(drive.writes, writes, "no write when nothing changed");
});

test("newer edits win and deletions spread", async () => {
	const drive = new FakeDrive();
	const phone = new Device(meme("a"), meme("b"));
	const laptop = new Device();
	await runSync(phone, drive);
	await runSync(laptop, drive);
	laptop.memes.set("a", { ...laptop.memes.get("a")!, tags: ["work"], updated: 50 });
	phone.memes.set("a", { ...phone.memes.get("a")!, title: "older", updated: 40 });
	phone.delete("b", 60);
	await runSync(laptop, drive);
	await runSync(phone, drive);
	await runSync(laptop, drive);
	assert.deepEqual(phone.memes.get("a")!.tags, ["work"]);
	assert.equal(phone.memes.get("a")!.title, "a");
	assert.ok(!laptop.memes.has("b"));
	assert.ok(!drive.files.has("b"));
	assert.equal(drive.index!.deleted["b"], 60);
});

test("a meme restored after deletion stays", () => {
	const plan = planSync([meme("a", { updated: 20 })], {}, { version: 1, memes: [], deleted: { a: 10 } });
	assert.equal(plan.upload.length, 1);
	assert.deepEqual(plan.index.deleted, {});
});

test("conflicting index write is retried", async () => {
	const drive = new FakeDrive();
	drive.conflictOnce = true;
	await runSync(new Device(meme("a")), drive);
	assert.equal(drive.index!.memes.length, 1);
});

test("toMeta keeps only synced fields and fills updated", () => {
	const meta = toMeta(meme("a", { added: 7 }));
	assert.equal(meta.updated, 7);
	assert.ok(!("blob" in meta));
});
