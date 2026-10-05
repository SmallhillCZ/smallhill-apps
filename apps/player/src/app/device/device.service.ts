import { Injectable, signal } from "@angular/core";
import { DriveItem, isAudio } from "../onedrive/items";
import { idbDelete, idbGet, idbSet } from "../storage/idb";

export type DeviceStatus = "loading" | "empty" | "permission" | "ready";

interface DirectoryHandle {
	kind: "directory";
	name: string;
	entries(): AsyncIterableIterator<[string, DirectoryHandle | FileHandle]>;
	getDirectoryHandle(name: string): Promise<DirectoryHandle>;
	getFileHandle(name: string): Promise<FileHandle>;
	queryPermission(options: { mode: "read" }): Promise<PermissionState>;
	requestPermission(options: { mode: "read" }): Promise<PermissionState>;
}

interface FileHandle {
	kind: "file";
	name: string;
	getFile(): Promise<File>;
}

type PickerWindow = Window & {
	showDirectoryPicker?: (options?: { id?: string; mode?: "read" }) => Promise<DirectoryHandle>;
};

const HANDLE_KEY = "device";

export interface FileTree {
	folders: Map<string, DriveItem[]>;
	files: Map<string, File>;
}

export function buildTree(files: Iterable<File>): FileTree {
	const tree = new Map<string, DriveItem[]>();
	const audio = new Map<string, File>();
	const add = (parent: string, item: DriveItem) => {
		const list = tree.get(parent) ?? [];
		if (!list.some((existing) => existing.id === item.id)) list.push(item);
		tree.set(parent, list);
	};
	for (const file of files) {
		const parts = (file.webkitRelativePath || file.name).split("/").slice(1);
		if (!parts.length || parts.some((part) => part.startsWith("."))) continue;
		for (let i = 0; i < parts.length - 1; i++) {
			add(parts.slice(0, i).join("/"), { id: parts.slice(0, i + 1).join("/"), name: parts[i], folder: {} });
		}
		const item: DriveItem = { id: parts.join("/"), name: parts.at(-1)!, file: { mimeType: file.type } };
		if (!isAudio(item)) continue;
		add(parts.slice(0, -1).join("/"), item);
		audio.set(item.id, file);
	}
	return { folders: tree, files: audio };
}

@Injectable({ providedIn: "root" })
export class DeviceService {
	readonly supported = typeof window !== "undefined" && "showDirectoryPicker" in window;
	readonly status = signal<DeviceStatus>("loading");
	readonly rootName = signal<string | null>(null);

	private handle: DirectoryHandle | null = null;
	private tree: FileTree | null = null;

	constructor() {
		void this.init();
	}

	private async init(): Promise<void> {
		const handle = this.supported ? await idbGet<DirectoryHandle>("handles", HANDLE_KEY) : null;
		if (!handle) {
			this.status.set("empty");
			return;
		}
		this.handle = handle;
		this.rootName.set(handle.name);
		try {
			this.status.set((await handle.queryPermission({ mode: "read" })) === "granted" ? "ready" : "permission");
		} catch {
			this.status.set("permission");
		}
	}

	async choose(): Promise<boolean> {
		const picker = (window as PickerWindow).showDirectoryPicker;
		if (!picker) return false;
		try {
			const handle = await picker({ id: "player", mode: "read" });
			this.handle = handle;
			this.tree = null;
			this.rootName.set(handle.name);
			this.status.set("ready");
			await idbSet("handles", HANDLE_KEY, handle);
			return true;
		} catch {
			return false;
		}
	}

	async allow(): Promise<void> {
		if (!this.handle) return;
		try {
			if ((await this.handle.requestPermission({ mode: "read" })) === "granted") this.status.set("ready");
		} catch {}
	}

	useFiles(files: FileList | null): boolean {
		if (!files?.length) return false;
		const first = files[0].webkitRelativePath.split("/")[0] || null;
		this.handle = null;
		this.tree = buildTree(Array.from(files));
		this.rootName.set(first);
		this.status.set("ready");
		void idbDelete("handles", HANDLE_KEY);
		return true;
	}

	forget(): void {
		this.handle = null;
		this.tree = null;
		this.rootName.set(null);
		this.status.set("empty");
		void idbDelete("handles", HANDLE_KEY);
	}

	async children(folderId: string | null): Promise<DriveItem[]> {
		if (this.tree) return this.tree.folders.get(folderId ?? "") ?? [];
		const dir = await this.directory(folderId);
		const items: DriveItem[] = [];
		for await (const [name, entry] of dir.entries()) {
			if (name.startsWith(".")) continue;
			const id = folderId ? `${folderId}/${name}` : name;
			if (entry.kind === "directory") items.push({ id, name, folder: {} });
			else items.push({ id, name, file: {} });
		}
		return items;
	}

	async downloadUrl(id: string): Promise<string> {
		if (this.tree) {
			const file = this.tree.files.get(id);
			if (!file) throw new Error("File not found");
			return URL.createObjectURL(file);
		}
		const parts = id.split("/");
		const dir = await this.directory(parts.slice(0, -1).join("/") || null);
		const file = await (await dir.getFileHandle(parts.at(-1)!)).getFile();
		return URL.createObjectURL(file);
	}

	private async directory(folderId: string | null): Promise<DirectoryHandle> {
		if (!this.handle) throw new Error("No folder");
		let dir = this.handle;
		for (const name of folderId ? folderId.split("/") : []) dir = await dir.getDirectoryHandle(name);
		return dir;
	}
}
