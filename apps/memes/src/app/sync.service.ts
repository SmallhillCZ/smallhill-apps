import { Injectable, effect, inject, signal, untracked } from "@angular/core";
import * as db from "./db";
import { Memes } from "./memes.service";
import { OneDrive } from "./onedrive";
import { type LocalLibrary, runSync } from "./sync";

export type SyncState = "off" | "syncing" | "synced" | "error";

const LAST_KEY = "memes.onedrive.last";
const DEBOUNCE = 2000;
const STALE = 60_000;

@Injectable({ providedIn: "root" })
export class Sync {
	private readonly memes = inject(Memes);
	readonly drive = inject(OneDrive);
	readonly state = signal<SyncState>("off");
	readonly last = signal<number | null>(readLast());

	private running: Promise<void> | null = null;
	private again = false;
	private timer: ReturnType<typeof setTimeout> | undefined;

	private readonly local: LocalLibrary = {
		all: () => db.getAll(),
		deleted: () => this.memes.deleted(),
		put: (memes) => db.putAll(memes),
		remove: async (ids) => {
			for (const id of ids) await db.remove(id);
		},
	};

	constructor() {
		effect(() => {
			const status = this.drive.status();
			untracked(() => {
				if (status === "signedIn") this.sync();
				else if (status !== "loading") this.state.set("off");
			});
		});
		effect(() => {
			if (!this.memes.changes()) return;
			untracked(() => this.schedule());
		});
		if (typeof document !== "undefined") {
			document.addEventListener("visibilitychange", () => {
				if (document.visibilityState === "visible" && Date.now() - (this.last() ?? 0) > STALE) this.sync();
			});
			addEventListener("online", () => this.sync());
		}
	}

	schedule() {
		if (this.drive.status() !== "signedIn") return;
		clearTimeout(this.timer);
		this.timer = setTimeout(() => this.sync(), DEBOUNCE);
	}

	sync(): Promise<void> {
		if (this.drive.status() !== "signedIn") return Promise.resolve();
		clearTimeout(this.timer);
		if (this.running) {
			this.again = true;
			return this.running;
		}
		this.running = this.run().finally(() => {
			this.running = null;
			if (this.again) {
				this.again = false;
				this.sync();
			}
		});
		return this.running;
	}

	async signOut() {
		clearTimeout(this.timer);
		await this.drive.signOut();
		this.state.set("off");
		this.last.set(null);
		try {
			localStorage.removeItem(LAST_KEY);
		} catch {}
	}

	private async run() {
		this.state.set("syncing");
		try {
			const result = await runSync(this.local, this.drive);
			if (result.changed) await this.memes.load();
			const now = Date.now();
			this.last.set(now);
			try {
				localStorage.setItem(LAST_KEY, String(now));
			} catch {}
			this.state.set("synced");
		} catch (error) {
			console.error(error);
			this.state.set(this.drive.status() === "signedIn" ? "error" : "off");
		}
	}
}

function readLast(): number | null {
	try {
		const value = Number(localStorage.getItem(LAST_KEY));
		return value > 0 ? value : null;
	} catch {
		return null;
	}
}
