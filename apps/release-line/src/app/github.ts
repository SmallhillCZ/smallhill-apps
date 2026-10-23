import { Injectable, inject } from "@angular/core";
import { Auth } from "./auth";
import { type Graph, layout } from "./core/graph";
import { releaseTagNames, shownTagNames } from "./core/tags";
import { TEMP_PREFIX, type TagConfig, type Workflow, parseConfig, parseWorkflow } from "./core/workflows";

export const API = "https://api.github.com";

export type GithubError = "auth" | "notfound" | "offline" | "rate" | "failed" | "workflow";

export class GithubFailure extends Error {
	constructor(
		readonly kind: GithubError,
		readonly detail = "",
	) {
		super(detail || kind);
	}
}

export interface User {
	login: string;
	name: string | null;
	avatarUrl: string;
}

export interface RepoSummary {
	fullName: string;
	description: string | null;
	pushedAt: string;
	private: boolean;
}

export interface Commit {
	oid: string;
	short: string;
	message: string;
	date: string;
	author: string;
	login: string | null;
	url: string;
	parents: string[];
}

export interface Ref {
	name: string;
	oid: string;
	date: string;
}

export type BranchMode = "range" | "default" | "all";

export interface RepoData {
	owner: string;
	name: string;
	defaultBranch: string;
	branches: Ref[];
	allBranches: number;
	tags: Ref[];
	releaseTags: string[];
	shownTags: string[];
	commits: Commit[];
	graph: Graph<Commit>;
	since: string | null;
	truncated: boolean;
	canPush: boolean;
}

export interface WorkflowSet {
	workflows: Workflow[];
	config: Record<string, TagConfig>;
	hasConfig: boolean;
}

export interface Run {
	id: number;
	status: string;
	conclusion: string | null;
	url: string;
	createdAt: string;
	headSha: string;
}

const COMMIT_FIELDS = `oid abbreviatedOid messageHeadline committedDate url author { name user { login } } parents(first: 4) { nodes { oid } }`;
const MAX_COMMITS = 1500;
const MAX_BRANCHES = 20;

interface RawCommit {
	oid: string;
	abbreviatedOid: string;
	messageHeadline: string;
	committedDate: string;
	url: string;
	author: { name: string | null; user: { login: string } | null } | null;
	parents: { nodes: { oid: string }[] };
}

interface RawRef {
	name: string;
	target: {
		oid: string;
		committedDate?: string;
		target?: { oid: string; committedDate?: string };
	};
}

interface History {
	nodes: RawCommit[];
	pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

const toCommit = (c: RawCommit): Commit => ({
	oid: c.oid,
	short: c.abbreviatedOid.slice(0, 7),
	message: c.messageHeadline,
	date: c.committedDate,
	author: c.author?.name ?? c.author?.user?.login ?? "",
	login: c.author?.user?.login ?? null,
	url: c.url,
	parents: c.parents.nodes.map((p) => p.oid),
});

const toRef = (r: RawRef): Ref | null => {
	const target = r.target.target ?? r.target;
	if (!target.committedDate) return null;
	return { name: r.name, oid: target.oid, date: target.committedDate };
};

@Injectable({ providedIn: "root" })
export class Github {
	private readonly auth = inject(Auth);

	async request<T>(path: string, init: RequestInit = {}): Promise<T> {
		const token = this.auth.token();
		if (!token) throw new GithubFailure("auth");
		let res: Response;
		try {
			res = await fetch(path.startsWith("http") ? path : API + path, {
				...init,
				cache: "no-store",
				headers: {
					Accept: "application/vnd.github+json",
					Authorization: `Bearer ${token}`,
					"X-GitHub-Api-Version": "2022-11-28",
					...(init.body ? { "Content-Type": "application/json" } : {}),
					...(init.headers as Record<string, string> | undefined),
				},
			});
		} catch {
			throw new GithubFailure("offline");
		}
		if (res.status === 401) {
			this.auth.setToken(null);
			throw new GithubFailure("auth");
		}
		if ((res.status === 403 || res.status === 429) && res.headers.get("x-ratelimit-remaining") === "0") {
			throw new GithubFailure("rate");
		}
		if (res.status === 404) throw new GithubFailure("notfound");
		if (!res.ok) {
			const body = (await res.json().catch(() => ({}))) as { message?: string };
			throw new GithubFailure(res.status === 422 ? "workflow" : "failed", body.message ?? String(res.status));
		}
		if (res.status === 204) return undefined as T;
		const text = await res.text();
		return (text ? JSON.parse(text) : undefined) as T;
	}

	async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
		const res = await this.request<{ data?: T; errors?: { type?: string; message: string }[] }>("/graphql", {
			method: "POST",
			body: JSON.stringify({ query, variables }),
		});
		if (res.errors?.length) {
			if (res.errors.some((e) => e.type === "NOT_FOUND")) throw new GithubFailure("notfound");
			if (res.errors.some((e) => e.type === "RATE_LIMITED")) throw new GithubFailure("rate");
			if (!res.data) throw new GithubFailure("failed", res.errors[0].message);
		}
		return res.data as T;
	}

	async user(): Promise<User> {
		const u = await this.request<{ login: string; name: string | null; avatar_url: string }>("/user");
		return { login: u.login, name: u.name, avatarUrl: u.avatar_url };
	}

	async repos(): Promise<RepoSummary[]> {
		const list = await this.request<
			{ full_name: string; description: string | null; pushed_at: string; private: boolean }[]
		>("/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator,organization_member");
		return list.map((r) => ({
			fullName: r.full_name,
			description: r.description,
			pushedAt: r.pushed_at,
			private: r.private,
		}));
	}

	async load(
		owner: string,
		name: string,
		patterns: string[],
		mode: BranchMode,
		autoPick?: (names: string[]) => string[],
	): Promise<RepoData> {
		const refs = await this.graphql<{
			repository: {
				defaultBranchRef: { name: string; target: { oid: string } } | null;
				viewerPermission: string | null;
				branches: { totalCount: number; nodes: RawRef[] };
				tags: { nodes: RawRef[] };
			} | null;
		}>(
			`query($owner: String!, $name: String!) {
				repository(owner: $owner, name: $name) {
					defaultBranchRef { name target { oid } }
					viewerPermission
					branches: refs(refPrefix: "refs/heads/", first: 100, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
						totalCount
						nodes { name target { oid ... on Commit { committedDate } } }
					}
					tags: refs(refPrefix: "refs/tags/", first: 100, orderBy: { field: TAG_COMMIT_DATE, direction: DESC }) {
						nodes { name target { oid ... on Commit { committedDate } ... on Tag { target { oid ... on Commit { committedDate } } } } }
					}
				}
			}`,
			{ owner, name },
		);
		const repo = refs.repository;
		if (!repo || !repo.defaultBranchRef) throw new GithubFailure("notfound");
		const defaultBranch = repo.defaultBranchRef.name;
		const allBranches = repo.branches.nodes.map(toRef).filter((r): r is Ref => !!r);
		const tags = repo.tags.nodes.map(toRef).filter((r): r is Ref => !!r);
		const tagNames = tags.map((t) => t.name);
		const releaseTags =
			!patterns.length && autoPick
				? autoPick(releaseTagNames(tagNames, []))
				: releaseTagNames(tagNames, patterns);
		const shownTags = [...new Set([...releaseTags, ...shownTagNames(tagNames, patterns)])];
		const main = allBranches.find((b) => b.name === defaultBranch)!;

		let since: string | null = null;
		const releaseDates = tags.filter((t) => releaseTags.includes(t.name)).map((t) => t.date);
		if (releaseDates.length) since = releaseDates.reduce((a, b) => (a < b ? a : b));
		else {
			const recent = await this.histories(owner, name, [main], null, 40, 1);
			const list = recent.get(main.name) ?? [];
			since = list.length ? list[list.length - 1].date : null;
		}

		const visible = allBranches.filter((b) => !b.name.startsWith(TEMP_PREFIX));
		let branches =
			mode === "default"
				? [main]
				: mode === "all"
					? visible
					: visible.filter((b) => b.name === defaultBranch || !since || b.date >= since);
		branches = [main, ...branches.filter((b) => b !== main)].slice(0, MAX_BRANCHES);

		const sinceArg = since ? new Date(new Date(since).getTime() - 1000).toISOString() : null;
		const histories = await this.histories(owner, name, branches, sinceArg, 100, 6);
		const byOid = new Map<string, Commit>();
		let truncated = false;
		for (const list of histories.values()) {
			for (const c of list) {
				if (byOid.size >= MAX_COMMITS) truncated = true;
				else byOid.set(c.oid, c);
			}
		}
		const commits = [...byOid.values()];
		const graph = layout(commits, main.oid);
		return {
			owner,
			name,
			defaultBranch,
			branches,
			allBranches: visible.length,
			tags,
			releaseTags,
			shownTags,
			commits: graph.nodes.map((n) => n.commit),
			graph,
			since,
			truncated: truncated || histories.size < branches.length,
			canPush: ["ADMIN", "MAINTAIN", "WRITE"].includes(repo.viewerPermission ?? ""),
		};
	}

	private async histories(
		owner: string,
		name: string,
		branches: Ref[],
		since: string | null,
		page: number,
		maxPages: number,
	): Promise<Map<string, Commit[]>> {
		const out = new Map<string, Commit[]>();
		const seen = new Set<string>();
		let todo = branches.map((b) => ({ branch: b, cursor: null as string | null, pages: 0 }));
		while (todo.length) {
			const batch = todo.slice(0, 10);
			const fields = batch
				.map(
					(t, i) =>
						`b${i}: object(oid: "${t.branch.oid}") { ... on Commit { history(first: ${page}${since ? `, since: $since` : ""}${t.cursor ? `, after: ${JSON.stringify(t.cursor)}` : ""}) { nodes { ${COMMIT_FIELDS} } pageInfo { hasNextPage endCursor } } } }`,
				)
				.join("\n");
			const data = await this.graphql<{ repository: Record<string, { history: History } | null> }>(
				`query($owner: String!, $name: String!${since ? ", $since: GitTimestamp" : ""}) { repository(owner: $owner, name: $name) { ${fields} } }`,
				since ? { owner, name, since } : { owner, name },
			);
			const next: typeof todo = [];
			batch.forEach((t, i) => {
				const history = data.repository[`b${i}`]?.history;
				if (!history) return;
				const commits = history.nodes.map(toCommit);
				const known = commits.some((c) => seen.has(c.oid));
				for (const c of commits) seen.add(c.oid);
				out.set(t.branch.name, [...(out.get(t.branch.name) ?? []), ...commits]);
				const pages = t.pages + 1;
				if (history.pageInfo.hasNextPage && !known && pages < maxPages) {
					next.push({ branch: t.branch, cursor: history.pageInfo.endCursor, pages });
				}
			});
			todo = [...next, ...todo.slice(10)];
		}
		return out;
	}

	async workflows(owner: string, name: string): Promise<WorkflowSet> {
		const list = await this.request<{ workflows: { id: number; name: string; path: string; state: string }[] }>(
			`/repos/${owner}/${name}/actions/workflows?per_page=100`,
		);
		const files = list.workflows.filter((w) => w.state === "active" && w.path.startsWith(".github/workflows/"));
		const fields = [
			`config: object(expression: "HEAD:.github/release-line.yml") { ... on Blob { text } }`,
			...files.map(
				(w, i) => `w${i}: object(expression: ${JSON.stringify(`HEAD:${w.path}`)}) { ... on Blob { text } }`,
			),
		].join("\n");
		const data = await this.graphql<{ repository: Record<string, { text: string | null } | null> }>(
			`query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { ${fields} } }`,
			{ owner, name },
		);
		const configText = data.repository["config"]?.text ?? null;
		return {
			workflows: files.map((w, i) =>
				parseWorkflow({ id: w.id, name: w.name, path: w.path }, data.repository[`w${i}`]?.text ?? ""),
			),
			config: parseConfig(configText),
			hasConfig: !!configText,
		};
	}

	async lastRun(owner: string, name: string, workflowId: number): Promise<Run | null> {
		const res = await this.request<{ workflow_runs: RawRun[] }>(
			`/repos/${owner}/${name}/actions/workflows/${workflowId}/runs?per_page=1&exclude_pull_requests=true`,
		);
		return res.workflow_runs[0] ? toRun(res.workflow_runs[0]) : null;
	}

	async run(owner: string, name: string, runId: number): Promise<Run> {
		return toRun(await this.request<RawRun>(`/repos/${owner}/${name}/actions/runs/${runId}`));
	}

	async findDispatchedRun(owner: string, name: string, workflowId: number, after: string, actor: string) {
		const res = await this.request<{ workflow_runs: RawRun[] }>(
			`/repos/${owner}/${name}/actions/workflows/${workflowId}/runs?event=workflow_dispatch&per_page=10&actor=${encodeURIComponent(actor)}`,
		);
		const from = new Date(after).getTime() - 10_000;
		const runs = res.workflow_runs.filter((r) => new Date(r.created_at).getTime() >= from);
		return runs.length ? toRun(runs[runs.length - 1]) : null;
	}

	async dispatch(owner: string, name: string, workflowId: number, ref: string, inputs: Record<string, string>) {
		const res = await this.request<{ workflow_run_id?: number; html_url?: string } | undefined>(
			`/repos/${owner}/${name}/actions/workflows/${workflowId}/dispatches`,
			{ method: "POST", body: JSON.stringify({ ref, inputs, return_run_details: true }) },
		);
		return { runId: res?.workflow_run_id ?? null, url: res?.html_url ?? null };
	}

	async moveTag(owner: string, name: string, tag: string, sha: string) {
		await this.request(`/repos/${owner}/${name}/git/refs/tags/${encodeURIComponent(tag)}`, {
			method: "PATCH",
			body: JSON.stringify({ sha, force: true }),
		});
	}

	async createBranch(owner: string, name: string, branch: string, sha: string) {
		try {
			await this.request(`/repos/${owner}/${name}/git/refs`, {
				method: "POST",
				body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
			});
		} catch (e) {
			if (!(e instanceof GithubFailure && e.kind === "workflow")) throw e;
			await this.request(`/repos/${owner}/${name}/git/refs/heads/${branch}`, {
				method: "PATCH",
				body: JSON.stringify({ sha, force: true }),
			});
		}
	}

	async deleteBranch(owner: string, name: string, branch: string) {
		await this.request(`/repos/${owner}/${name}/git/refs/heads/${branch}`, { method: "DELETE" }).catch(() => {});
	}
}

interface RawRun {
	id: number;
	status: string;
	conclusion: string | null;
	html_url: string;
	created_at: string;
	head_sha: string;
}

const toRun = (r: RawRun): Run => ({
	id: r.id,
	status: r.status,
	conclusion: r.conclusion,
	url: r.html_url,
	createdAt: r.created_at,
	headSha: r.head_sha,
});
