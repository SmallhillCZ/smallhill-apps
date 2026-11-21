import { Injectable, computed, signal } from "@angular/core";
import * as db from "./db";
import { type Meme, fileName, isMedia, newId, sortMemes, tagCounts, titleFromName, typeOf } from "./library";
import { readZip, writeZip } from "./zip";

export interface MemeView extends Meme {
	url: string;
	video: boolean;
}

export type ActionResult = "shared" | "cancelled" | "downloaded" | "copied" | "copiedStill" | "failed" | "video";

const BACKUP_INDEX = "memes.json";

@Injectable({ providedIn: "root" })
export class Memes {
	private readonly urls = new Map<string, string>();
	private readonly all = signal<MemeView[]>([]);
	readonly loaded = signal(false);
	readonly memes = computed(() => sortMemes(this.all()));
	readonly tags = computed(() => tagCounts(this.all()));

	async load(): Promise<void> {
		const memes = await db.getAll();
		this.all.set(memes.map((m) => this.view(m)));
		this.loaded.set(true);
	}

	find(id: string): MemeView | undefined {
		return this.all().find((m) => m.id === id);
	}

	async addFiles(files: Iterable<File | Blob>, title = ""): Promise<MemeView[]> {
		const now = Date.now();
		const memes: Meme[] = [];
		for (const file of files) {
			const name = file instanceof File ? file.name : "";
			const type = typeOf(name, file.type);
			if (!isMedia(type) || !file.size) continue;
			memes.push({
				id: newId(),
				blob: new Blob([file], { type }),
				type,
				name,
				title: title || titleFromName(name),
				tags: [],
				added: now + memes.length,
				used: 0,
				uses: 0,
			});
		}
		if (!memes.length) return [];
		await db.putAll(memes);
		this.persist();
		const views = memes.map((m) => this.view(m));
		this.all.update((all) => [...all, ...views]);
		return views;
	}

	async update(id: string, changes: Partial<Pick<Meme, "title" | "tags" | "used" | "uses">>): Promise<void> {
		const current = this.find(id);
		if (!current) return;
		const next = { ...current, ...changes };
		const { url, video, ...meme } = next;
		await db.putAll([meme]);
		this.all.update((all) => all.map((m) => (m.id === id ? next : m)));
	}

	async remove(id: string): Promise<MemeView | undefined> {
		const meme = this.find(id);
		if (!meme) return;
		await db.remove(id);
		this.all.update((all) => all.filter((m) => m.id !== id));
		return meme;
	}

	async restore(meme: MemeView): Promise<void> {
		const { url, video, ...stored } = meme;
		await db.putAll([stored]);
		this.all.update((all) => [...all.filter((m) => m.id !== meme.id), meme]);
	}

	async share(meme: MemeView): Promise<ActionResult> {
		const file = new File([meme.blob], fileName(meme), { type: meme.type });
		const data: ShareData = { files: [file] };
		if (navigator.canShare?.(data)) {
			try {
				await navigator.share(data);
			} catch (e) {
				if ((e as DOMException)?.name === "AbortError") return "cancelled";
				return this.download(meme);
			}
			await this.markUsed(meme);
			return "shared";
		}
		return this.download(meme);
	}

	async download(meme: MemeView): Promise<ActionResult> {
		const a = document.createElement("a");
		a.href = meme.url;
		a.download = fileName(meme);
		document.body.append(a);
		a.click();
		a.remove();
		await this.markUsed(meme);
		return "downloaded";
	}

	async copy(meme: MemeView): Promise<ActionResult> {
		if (meme.video) return "video";
		if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) return "failed";
		const still = meme.type !== "image/png";
		try {
			const png = still ? toPng(meme.blob) : Promise.resolve(meme.blob);
			await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
		} catch {
			return "failed";
		}
		await this.markUsed(meme);
		return still && meme.type === "image/gif" ? "copiedStill" : "copied";
	}

	async backup(): Promise<Blob> {
		const memes = this.memes();
		const index = memes.map(({ url, video, blob, ...meta }) => ({
			...meta,
			file: `files/${meta.id}-${fileName(meta)}`,
		}));
		const entries = [{ name: BACKUP_INDEX, data: new TextEncoder().encode(JSON.stringify(index, null, 1)) }];
		for (const [i, meme] of memes.entries())
			entries.push({ name: index[i].file, data: new Uint8Array(await meme.blob.arrayBuffer()) });
		return new Blob([writeZip(entries)], { type: "application/zip" });
	}

	async restoreBackup(file: Blob): Promise<number> {
		const entries = await readZip(new Uint8Array(await file.arrayBuffer()));
		const byName = new Map(entries.map((e) => [e.name, e.data]));
		const indexData = byName.get(BACKUP_INDEX);
		const memes: Meme[] = [];
		if (indexData) {
			const index = JSON.parse(new TextDecoder().decode(indexData)) as (Omit<Meme, "blob"> & { file: string })[];
			for (const { file: path, ...meta } of index) {
				const data = byName.get(path);
				if (!data || typeof meta.id !== "string" || !isMedia(meta.type)) continue;
				memes.push({
					...meta,
					tags: Array.isArray(meta.tags) ? meta.tags : [],
					blob: new Blob([data as Uint8Array<ArrayBuffer>], { type: meta.type }),
				});
			}
		} else {
			const now = Date.now();
			for (const entry of entries) {
				const name = entry.name.split("/").pop() ?? "";
				const type = typeOf(name);
				if (!isMedia(type)) continue;
				memes.push({
					id: newId(),
					blob: new Blob([entry.data as Uint8Array<ArrayBuffer>], { type }),
					type,
					name,
					title: titleFromName(name),
					tags: [],
					added: now + memes.length,
					used: 0,
					uses: 0,
				});
			}
		}
		if (!memes.length) throw new Error("empty backup");
		await db.putAll(memes);
		this.persist();
		await this.load();
		return memes.length;
	}

	private async markUsed(meme: MemeView): Promise<void> {
		const current = this.find(meme.id) ?? meme;
		await this.update(meme.id, { used: Date.now(), uses: current.uses + 1 });
	}

	private view(meme: Meme): MemeView {
		let url = this.urls.get(meme.id);
		if (!url) {
			url = URL.createObjectURL(meme.blob);
			this.urls.set(meme.id, url);
		}
		return { ...meme, url, video: meme.type.startsWith("video/") };
	}

	private persist() {
		navigator.storage?.persist?.().catch(() => {});
	}
}

async function toPng(blob: Blob): Promise<Blob> {
	const bitmap = await createImageBitmap(blob);
	const canvas = document.createElement("canvas");
	canvas.width = bitmap.width;
	canvas.height = bitmap.height;
	canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
	bitmap.close();
	return new Promise((resolve, reject) =>
		canvas.toBlob((png) => (png ? resolve(png) : reject(new Error("png"))), "image/png"),
	);
}
