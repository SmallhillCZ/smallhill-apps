import { Injectable, inject, signal } from "@angular/core";
import { Github, type Run } from "./github";
import type { BranchMode } from "./github";
import { I18n } from "./i18n";

export interface RepoSettings {
	filter: string;
	branches: BranchMode;
	picks: Record<string, string>;
}

export interface Watch {
	repo: string;
	tag: string;
	runId: number | null;
	workflow: string;
}

export interface Pending {
	repo: string;
	tag: string;
	sha: string;
	workflowId: number;
	dispatchedAt: string;
	actor: string;
	runId: number | null;
	url: string | null;
	tempBranch: string | null;
}

const SETTINGS_PREFIX = "release-line.repo.";
const RECENT_KEY = "release-line.recent";
const PENDING_KEY = "release-line.pending";
const WATCH_KEY = "release-line.notify";
const PENDING_TTL = 3 * 60 * 60 * 1000;

function read<T>(key: string): T | null {
	try {
		const v = localStorage.getItem(key);
		return v ? (JSON.parse(v) as T) : null;
	} catch {
		return null;
	}
}

function write(key: string, value: unknown) {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, JSON.stringify(value));
	} catch {}
}

@Injectable({ providedIn: "root" })
export class Store {
	private readonly github = inject(Github);
	private readonly i18n = inject(I18n);
	readonly recent = signal<string[]>(read<string[]>(RECENT_KEY) ?? []);
	readonly pending = signal<Pending[]>(
		(read<Pending[]>(PENDING_KEY) ?? []).filter(
			(p) => Date.now() - new Date(p.dispatchedAt).getTime() < PENDING_TTL,
		),
	);
	readonly finished = signal<{ repo: string; run: Run | null; at: number } | null>(null);
	readonly watches = signal<Watch[]>(read<Watch[]>(WATCH_KEY) ?? []);
	readonly canNotify = typeof Notification !== "undefined";
	private timer: ReturnType<typeof setTimeout> | null = null;

	settings(repo: string): RepoSettings {
		const s = read<Partial<RepoSettings>>(SETTINGS_PREFIX + repo) ?? {};
		return { filter: s.filter ?? "", branches: s.branches ?? "range", picks: s.picks ?? {} };
	}

	saveSettings(repo: string, settings: RepoSettings) {
		write(SETTINGS_PREFIX + repo, settings);
	}

	visit(repo: string) {
		const list = [repo, ...this.recent().filter((r) => r !== repo)].slice(0, 8);
		this.recent.set(list);
		write(RECENT_KEY, list);
	}

	addPending(p: Pending) {
		this.setPending([...this.pending().filter((x) => !(x.repo === p.repo && x.tag === p.tag)), p]);
		this.watch();
	}

	private setPending(list: Pending[]) {
		this.pending.set(list);
		write(PENDING_KEY, list.length ? list : null);
	}

	watching(repo: string, tag: string) {
		return this.watches().some((w) => w.repo === repo && w.tag === tag);
	}

	async toggleWatch(w: Watch): Promise<boolean> {
		const rest = this.watches().filter((x) => !(x.repo === w.repo && x.tag === w.tag));
		if (rest.length !== this.watches().length) {
			this.setWatches(rest);
			return true;
		}
		if (!this.canNotify) return false;
		const permission =
			Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
		if (permission !== "granted") return false;
		this.setWatches([...rest, w]);
		this.watch();
		return true;
	}

	private setWatches(list: Watch[]) {
		this.watches.set(list);
		write(WATCH_KEY, list.length ? list : null);
	}

	private async notify(repo: string, tag: string, run: Run | null) {
		const w = this.watches().find((x) => x.repo === repo && x.tag === tag);
		if (!w) return;
		this.setWatches(this.watches().filter((x) => x !== w));
		const t = this.i18n.t().notify;
		const state = run?.conclusion === "success" ? "success" : run?.conclusion === "failure" ? "failure" : "other";
		const title = `${tag}: ${t[state]}`;
		const url = run?.url ?? `https://github.com/${repo}/actions`;
		const options: NotificationOptions = {
			body: `${repo} · ${w.workflow}`,
			icon: "icons/icon-192x192.png",
			tag: `release-line:${repo}:${tag}`,
			data: { url, onActionClick: { default: { operation: "openWindow", url } } },
		};
		try {
			const reg = await navigator.serviceWorker?.getRegistration();
			if (reg) await reg.showNotification(title, options);
			else new Notification(title, options).onclick = () => window.open(url, "_blank");
		} catch {}
	}

	watch() {
		if (this.timer || !(this.pending().length || this.watches().some((w) => w.runId))) return;
		this.timer = setTimeout(() => {
			this.timer = null;
			this.check().finally(() => this.watch());
		}, 6000);
	}

	private async check() {
		for (const p of this.pending()) {
			const [owner, name] = p.repo.split("/");
			try {
				let run: Run | null = null;
				if (p.runId) run = await this.github.run(owner, name, p.runId);
				else run = await this.github.findDispatchedRun(owner, name, p.workflowId, p.dispatchedAt, p.actor);
				if (run && (!p.runId || p.url !== run.url)) {
					this.setPending(this.pending().map((x) => (x === p ? { ...x, runId: run!.id, url: run!.url } : x)));
				}
				const stale = Date.now() - new Date(p.dispatchedAt).getTime() > PENDING_TTL;
				const lost = !run && Date.now() - new Date(p.dispatchedAt).getTime() > 5 * 60 * 1000;
				if ((run && run.status === "completed") || stale || lost) {
					if (p.tempBranch) await this.github.deleteBranch(owner, name, p.tempBranch);
					this.setPending(this.pending().filter((x) => !(x.repo === p.repo && x.tag === p.tag)));
					this.finished.set({ repo: p.repo, run, at: Date.now() });
					await this.notify(p.repo, p.tag, run);
				}
			} catch {}
		}
		const orphan = (w: Watch) => !w.runId && !this.pending().some((p) => p.repo === w.repo && p.tag === w.tag);
		if (this.watches().some(orphan)) this.setWatches(this.watches().filter((w) => !orphan(w)));
		for (const w of this.watches()) {
			if (!w.runId || this.pending().some((p) => p.repo === w.repo && p.tag === w.tag)) continue;
			const [owner, name] = w.repo.split("/");
			try {
				const run = await this.github.run(owner, name, w.runId);
				if (run.status === "completed") {
					this.finished.set({ repo: w.repo, run, at: Date.now() });
					await this.notify(w.repo, w.tag, run);
				}
			} catch {}
		}
	}
}
