import { Injectable, signal } from "@angular/core";
import { DriveItem, isAudio } from "../onedrive/items";
import { idbDelete, idbGet, idbSet } from "../storage/idb";

export type DeviceStatus = "missing" | "permission" | "ready";

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

export interface PickedFolder {
	id: string;
	name: string;
}

const newId = () =>
	typeof crypto !== "undefined" && "randomUUID" in crypto
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(36).slice(2)}`;

@Injectable({ providedIn: "root" })
export class DeviceService {
	readonly supported = typeof window !== "undefined" && "showDirectoryPicker" in window;
	readonly states = signal<Record<string, DeviceStatus>>({});

	private readonly handles = new Map<string, DirectoryHandle>();
	private readonly trees = new Map<string, FileTree>();

	async init(ids: string[]): Promise<void> {
		await Promise.all(
			ids.map(async (id) => {
				if (this.states()[id]) return;
				const handle = this.supported ? await idbGet<DirectoryHandle>("handles", id) : null;
				if (!handle) {
					this.setState(id, "missing");
					return;
				}
				this.handles.set(id, handle);
				try {
					this.setState(
						id,
						(await handle.queryPermission({ mode: "read" })) === "granted" ? "ready" : "permission",
					);
				} catch {
					this.setState(id, "permission");
				}
			}),
		);
	}

	async pick(): Promise<PickedFolder | null> {
		const picker = (window as PickerWindow).showDirectoryPicker;
		if (!picker) return null;
		try {
			const handle = await picker({ id: "player", mode: "read" });
			const id = newId();
			this.handles.set(id, handle);
			this.setState(id, "ready");
			await idbSet("handles", id, handle);
			return { id, name: handle.name };
		} catch {
			return null;
		}
	}

	useFiles(files: FileList | null, id = newId()): PickedFolder | null {
		if (!files?.length) return null;
		this.trees.set(id, buildTree(Array.from(files)));
		this.setState(id, "ready");
		return { id, name: files[0].webkitRelativePath.split("/")[0] || "Folder" };
	}

	async allow(id: string): Promise<boolean> {
		const handle = this.handles.get(id);
		if (!handle) return false;
		try {
			if ((await handle.requestPermission({ mode: "read" })) === "granted") {
				this.setState(id, "ready");
				return true;
			}
		} catch {}
		return false;
	}

	remove(id: string): void {
		this.handles.delete(id);
		this.trees.delete(id);
		this.states.update(({ [id]: _, ...rest }) => rest);
		void idbDelete("handles", id);
	}

	async children(id: string, folderId: string | null): Promise<DriveItem[]> {
		const tree = this.trees.get(id);
		if (tree) return tree.folders.get(folderId ?? "") ?? [];
		const dir = await this.directory(id, folderId);
		const items: DriveItem[] = [];
		for await (const [name, entry] of dir.entries()) {
			if (name.startsWith(".")) continue;
			const itemId = folderId ? `${folderId}/${name}` : name;
			if (entry.kind === "directory") items.push({ id: itemId, name, folder: {} });
			else items.push({ id: itemId, name, file: {} });
		}
		return items;
	}

	async downloadUrl(id: string, fileId: string): Promise<string> {
		const tree = this.trees.get(id);
		if (tree) {
			const file = tree.files.get(fileId);
			if (!file) throw new Error("File not found");
			return URL.createObjectURL(file);
		}
		const parts = fileId.split("/");
		const dir = await this.directory(id, parts.slice(0, -1).join("/") || null);
		const file = await (await dir.getFileHandle(parts.at(-1)!)).getFile();
		return URL.createObjectURL(file);
	}

	private setState(id: string, state: DeviceStatus): void {
		this.states.update((states) => ({ ...states, [id]: state }));
	}

	private async directory(id: string, folderId: string | null): Promise<DirectoryHandle> {
		let dir = this.handles.get(id);
		if (!dir) throw new Error("No folder");
		for (const name of folderId ? folderId.split("/") : []) dir = await dir.getDirectoryHandle(name);
		return dir;
	}
}
