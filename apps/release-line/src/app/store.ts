import { Injectable, inject, signal } from "@angular/core";
import { Github, type Run } from "./github";
import type { BranchMode } from "./github";

export interface RepoSettings {
	filter: string;
	branches: BranchMode;
	picks: Record<string, string>;
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
	readonly recent = signal<string[]>(read<string[]>(RECENT_KEY) ?? []);
	readonly pending = signal<Pending[]>(
		(read<Pending[]>(PENDING_KEY) ?? []).filter(
			(p) => Date.now() - new Date(p.dispatchedAt).getTime() < PENDING_TTL,
		),
	);
	readonly finished = signal<{ repo: string; run: Run | null; at: number } | null>(null);
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

	watch() {
		if (this.timer || !this.pending().length) return;
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
				}
			} catch {}
		}
	}
}
