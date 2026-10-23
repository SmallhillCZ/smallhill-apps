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
	gap?: { count: number; target: string };
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
	anchors: string[];
	behind: Record<string, number>;
	total: number;
	since: string | null;
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
const MAX_BRANCHES = 20;
const MAIN_DEPTH = 30;
const BRANCH_DEPTH = 6;
const TAG_DEPTH = 3;
export const EXPAND_DEPTH = 100;
const MAX_TAG_ANCHORS = 40;
const MAX_GAPS = 20;
const SMALL_GAP = 8;
const FILL_ROUNDS = 3;
const MAX_SIDES = 20;
const SIDE_DEPTH = 30;
const COMPARE_TRIES = 3;

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

const iso = (date: string) => (date ? new Date(date).toISOString() : date);

const toCommit = (c: RawCommit): Commit => ({
	oid: c.oid,
	short: c.abbreviatedOid.slice(0, 7),
	message: c.messageHeadline,
	date: iso(c.committedDate),
	author: c.author?.name ?? c.author?.user?.login ?? "",
	login: c.author?.user?.login ?? null,
	url: c.url,
	parents: c.parents.nodes.map((p) => p.oid),
});

interface RestCommit {
	sha: string;
	html_url: string;
	commit: { message: string; author: { name: string } | null; committer: { date: string } | null };
	author: { login: string } | null;
	parents: { sha: string }[];
}

const fromRest = (c: RestCommit): Commit => ({
	oid: c.sha,
	short: c.sha.slice(0, 7),
	message: c.commit.message.split("\n")[0],
	date: iso(c.commit.committer?.date ?? ""),
	author: c.commit.author?.name ?? c.author?.login ?? "",
	login: c.author?.login ?? null,
	url: c.html_url,
	parents: c.parents.map((p) => p.sha),
});

interface Side {
	commits: Commit[];
	base: string | null;
}

const toRef = (r: RawRef): Ref | null => {
	const target = r.target.target ?? r.target;
	if (!target.committedDate) return null;
	return { name: r.name, oid: target.oid, date: iso(target.committedDate) };
};

export function olderStart(data: RepoData): string | null {
	const known = new Set(data.commits.map((c) => c.oid));
	for (let i = data.graph.nodes.length - 1; i >= 0; i--) {
		const c = data.graph.nodes[i].commit;
		if (!c.gap && c.parents[0] && !known.has(c.parents[0])) return c.parents[0];
	}
	return null;
}

@Injectable({ providedIn: "root" })
export class Github {
	private readonly auth = inject(Auth);
	private readonly compared = new Map<string, { status: string; ahead: number } | null>();
	private readonly merged = new Map<string, Side>();

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
			const recent = await this.fragments(owner, name, [{ oid: main.oid, first: MAIN_DEPTH }], null);
			since = recent.length ? recent.reduce((a, c) => (a < c.date ? a : c.date), recent[0].date) : null;
		}

		const visible = allBranches.filter((b) => !b.name.startsWith(TEMP_PREFIX));
		let branches =
			mode === "default"
				? [main]
				: mode === "all"
					? visible
					: visible.filter((b) => b.name === defaultBranch || !since || b.date >= since);
		branches = [main, ...branches.filter((b) => b !== main)].slice(0, MAX_BRANCHES);

		const anchorTags = tags
			.filter((t) => shownTags.includes(t.name) && (!since || t.date >= since))
			.sort((a, b) => (a.date < b.date ? 1 : -1));
		const tagAnchors = [
			...anchorTags.filter((t) => releaseTags.includes(t.name)),
			...anchorTags.filter((t) => !releaseTags.includes(t.name)).slice(0, MAX_TAG_ANCHORS),
		];
		const depth = new Map<string, number>();
		const want = (oid: string, first: number) => depth.set(oid, Math.max(depth.get(oid) ?? 0, first));
		want(main.oid, MAIN_DEPTH);
		for (const t of tagAnchors) want(t.oid, TAG_DEPTH);
		const sinceArg = since ? new Date(new Date(since).getTime() - 1000).toISOString() : null;
		const loaded = await this.fragments(
			owner,
			name,
			[...depth].map(([oid, first]) => ({ oid, first })),
			sinceArg,
		);
		const commits = new Map(loaded.map((c) => [c.oid, c]));
		const anchorOids = new Set(tagAnchors.map((t) => t.oid));
		const sides = await Promise.all(
			branches.filter((b) => b !== main).map((b) => this.branchCommits(owner, name, main.oid, b.oid)),
		);
		for (const side of sides) {
			for (const c of side.commits) if (!commits.has(c.oid)) commits.set(c.oid, c);
			if (side.base) anchorOids.add(side.base);
		}
		const behindEntries = await Promise.all(
			tags
				.filter((t) => releaseTags.includes(t.name))
				.map(async (t) => {
					if (t.oid === main.oid) return [t.name, 0] as const;
					const r = await this.compare(owner, name, t.oid, main.oid);
					return [t.name, r?.status === "ahead" ? r.ahead : null] as const;
				}),
		);
		const behind: Record<string, number> = {};
		for (const [tag, n] of behindEntries) if (n !== null) behind[tag] = n;
		await this.connect(owner, name, commits, anchorOids, main.oid);
		return this.assemble(
			{
				owner,
				name,
				defaultBranch,
				branches,
				allBranches: visible.length,
				tags,
				releaseTags,
				shownTags,
				since,
				canPush: ["ADMIN", "MAINTAIN", "WRITE"].includes(repo.viewerPermission ?? ""),
				behind,
			},
			commits,
			main.oid,
			anchorOids,
		);
	}

	async expand(data: RepoData, gapOid: string): Promise<RepoData> {
		const gap = data.commits.find((c) => c.oid === gapOid && c.gap);
		if (!gap?.gap) return data;
		const loaded = await this.fragments(
			data.owner,
			data.name,
			[{ oid: gap.oid, first: Math.min(gap.gap.count, EXPAND_DEPTH) }],
			null,
		);
		const commits = new Map(data.commits.map((c) => [c.oid, c]));
		for (const c of loaded) if (!commits.has(c.oid) || commits.get(c.oid)!.gap) commits.set(c.oid, c);
		const anchors = new Set(data.anchors);
		anchors.add(gap.gap.target);
		const main = data.branches.find((b) => b.name === data.defaultBranch)!;
		await this.connect(data.owner, data.name, commits, anchors, main.oid);
		return this.assemble(data, commits, main.oid, anchors);
	}

	async older(data: RepoData): Promise<RepoData> {
		const from = olderStart(data);
		if (!from) return data;
		const loaded = await this.fragments(data.owner, data.name, [{ oid: from, first: EXPAND_DEPTH }], null);
		const commits = new Map(data.commits.map((c) => [c.oid, c]));
		for (const c of loaded) if (!commits.has(c.oid) || commits.get(c.oid)!.gap) commits.set(c.oid, c);
		const anchors = new Set(data.anchors);
		const main = data.branches.find((b) => b.name === data.defaultBranch)!;
		await this.connect(data.owner, data.name, commits, anchors, main.oid);
		return this.assemble(data, commits, main.oid, anchors);
	}

	private assemble(
		base: Omit<RepoData, "commits" | "graph" | "anchors" | "total">,
		commits: Map<string, Commit>,
		head: string,
		anchors: Set<string>,
	): RepoData {
		const graph = layout([...commits.values()], head);
		const list = graph.nodes.map((n) => n.commit);
		return {
			...base,
			commits: list,
			graph,
			anchors: [...anchors],
			total: Math.max(
				list.reduce((n, c) => n + (c.gap?.count ?? 1), 0),
				...Object.values(base.behind).map((n) => n + 1),
			),
		};
	}

	private async fragments(
		owner: string,
		name: string,
		starts: { oid: string; first: number }[],
		since: string | null,
	): Promise<Commit[]> {
		const out: Commit[] = [];
		for (let i = 0; i < starts.length; i += 20) {
			const batch = starts.slice(i, i + 20);
			const fields = batch
				.map(
					(s, k) =>
						`f${k}: object(oid: "${s.oid}") { ... on Commit { history(first: ${s.first}${since ? ", since: $since" : ""}) { nodes { ${COMMIT_FIELDS} } } } }`,
				)
				.join("\n");
			const data = await this.graphql<{ repository: Record<string, { history: { nodes: RawCommit[] } } | null> }>(
				`query($owner: String!, $name: String!${since ? ", $since: GitTimestamp" : ""}) { repository(owner: $owner, name: $name) { ${fields} } }`,
				since ? { owner, name, since } : { owner, name },
			);
			batch.forEach((_, k) => out.push(...(data.repository[`f${k}`]?.history.nodes ?? []).map(toCommit)));
		}
		return out;
	}

	private async compare(owner: string, name: string, base: string, head: string) {
		const key = `${owner}/${name}:${base}...${head}`;
		if (!this.compared.has(key)) {
			const res = await this.request<{ status: string; ahead_by: number }>(
				`/repos/${owner}/${name}/compare/${base}...${head}?per_page=1`,
			).catch(() => null);
			this.compared.set(key, res ? { status: res.status, ahead: res.ahead_by } : null);
		}
		return this.compared.get(key)!;
	}

	private async connect(
		owner: string,
		name: string,
		commits: Map<string, Commit>,
		anchors: Set<string>,
		head: string,
	) {
		await this.sides(owner, name, commits);
		await this.link(owner, name, commits, anchors, head);
		for (let round = 0; round < FILL_ROUNDS; round++) {
			const small = [...commits.values()].filter((c) => c.gap && c.gap.count <= SMALL_GAP);
			if (!small.length) return;
			const filled = await this.fragments(
				owner,
				name,
				small.map((c) => ({ oid: c.oid, first: c.gap!.count })),
				null,
			);
			for (const c of filled) commits.set(c.oid, c);
			await this.link(owner, name, commits, anchors, head);
		}
	}

	private async sides(owner: string, name: string, commits: Map<string, Commit>) {
		const merges = [...commits.values()]
			.filter((c) => !c.gap && c.parents.slice(1).some((p) => !commits.has(p)))
			.sort((a, b) => (a.date < b.date ? 1 : -1))
			.slice(0, MAX_SIDES);
		const found = await Promise.all(
			merges.flatMap((m) =>
				m.parents
					.slice(1)
					.filter((p) => !commits.has(p))
					.map((p) => this.branchCommits(owner, name, m.parents[0], p)),
			),
		);
		for (const side of found) for (const c of side.commits) if (!commits.has(c.oid)) commits.set(c.oid, c);
	}

	private async branchCommits(owner: string, name: string, base: string, head: string): Promise<Side> {
		const key = `${owner}/${name}:${base}...${head}`;
		if (!this.merged.has(key)) {
			const res = await this.request<{ ahead_by: number; commits: RestCommit[]; merge_base_commit?: RestCommit }>(
				`/repos/${owner}/${name}/compare/${base}...${head}?per_page=${SIDE_DEPTH}`,
			).catch(() => null);
			const side: Side = { commits: [], base: null };
			if (res?.merge_base_commit) {
				side.base = res.merge_base_commit.sha;
				side.commits.push(fromRest(res.merge_base_commit));
			}
			if (res && res.ahead_by <= SIDE_DEPTH) side.commits.push(...res.commits.map(fromRest));
			else if (res)
				side.commits.push(...(await this.fragments(owner, name, [{ oid: head, first: BRANCH_DEPTH }], null)));
			this.merged.set(key, side);
		}
		return this.merged.get(key)!;
	}

	private async link(owner: string, name: string, commits: Map<string, Commit>, anchors: Set<string>, head: string) {
		for (const [oid, c] of commits) if (c.gap) commits.delete(oid);
		const real = [...commits.values()];
		const hasChild = new Set(real.flatMap((c) => c.parents));
		const targets = real.filter((c) => anchors.has(c.oid)).sort((a, b) => (a.date < b.date ? 1 : -1));
		const childDate = new Map<string, string>();
		for (const c of real) {
			const p = c.parents[0];
			if (p && !commits.has(p) && (childDate.get(p) ?? "") < c.date) childDate.set(p, c.date);
		}
		const missing = [...childDate].sort((a, b) => (a[1] < b[1] ? 1 : -1)).slice(0, MAX_GAPS);
		const found = await Promise.all(
			missing.map(async ([oid, date]) => {
				for (const target of targets.filter((t) => t.date <= date).slice(0, COMPARE_TRIES)) {
					const r = await this.compare(owner, name, target.oid, oid);
					if (r?.status === "ahead") return { oid, target, count: r.ahead };
				}
				return null;
			}),
		);
		const gaps = new Map(found.filter((f) => !!f).map((f) => [f.oid, f]));
		const used = new Set<string>();
		const place = (f: { oid: string; target: Commit; count: number }) => {
			if (used.has(f.target.oid) || commits.has(f.oid)) return false;
			used.add(f.target.oid);
			commits.set(f.oid, {
				oid: f.oid,
				short: f.oid.slice(0, 7),
				message: "",
				date: f.target.date,
				author: "",
				login: null,
				url: "",
				parents: [f.target.oid],
				gap: { count: f.count, target: f.target.oid },
			});
			return true;
		};
		const seen = new Set<string>();
		for (let oid: string | undefined = head; oid && !seen.has(oid);) {
			seen.add(oid);
			const c = commits.get(oid);
			if (c) oid = c.parents[0];
			else {
				const f = gaps.get(oid);
				if (!f || !place(f)) break;
				oid = f.target.oid;
			}
		}
		for (const f of [...gaps.values()].sort((a, b) => a.count - b.count)) place(f);
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
