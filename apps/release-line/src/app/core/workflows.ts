import { parse } from "yaml";

export interface WorkflowInput {
	name: string;
	description: string;
	type: "choice" | "boolean" | "string" | "number" | "environment";
	required: boolean;
	default: string;
	options: string[];
}

export interface Workflow {
	id: number;
	name: string;
	path: string;
	dispatchable: boolean;
	inputs: WorkflowInput[];
	source: string;
}

export interface TagConfig {
	workflow?: string;
	color?: string;
	inputs?: Record<string, string>;
}

export type MatchSource = "config" | "picked" | "name" | "content";

export interface TagMatch {
	workflow: Workflow;
	source: MatchSource;
	inputs: Record<string, string>;
	color?: string;
}

const COMMIT_INPUTS = ["ref", "sha", "commit"];

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function parseWorkflow(meta: { id: number; name: string; path: string }, source: string): Workflow {
	let doc: Record<string, unknown> | null = null;
	try {
		doc = asRecord(parse(source));
	} catch {}
	const on = doc?.["on"] ?? doc?.["true"];
	let dispatch: unknown = undefined;
	let dispatchable = false;
	if (typeof on === "string") dispatchable = on === "workflow_dispatch";
	else if (Array.isArray(on)) dispatchable = on.includes("workflow_dispatch");
	else if (asRecord(on) && "workflow_dispatch" in asRecord(on)!) {
		dispatchable = true;
		dispatch = asRecord(on)!["workflow_dispatch"];
	}
	const rawInputs = asRecord(asRecord(dispatch)?.["inputs"]) ?? {};
	const inputs = Object.entries(rawInputs).map(([name, raw]) => {
		const spec = asRecord(raw) ?? {};
		const type = String(spec["type"] ?? "string") as WorkflowInput["type"];
		return {
			name,
			description: String(spec["description"] ?? ""),
			type: ["choice", "boolean", "string", "number", "environment"].includes(type) ? type : "string",
			required: spec["required"] === true,
			default: spec["default"] === undefined || spec["default"] === null ? "" : String(spec["default"]),
			options: Array.isArray(spec["options"]) ? spec["options"].map(String) : [],
		};
	});
	return { ...meta, dispatchable, inputs, source };
}

export function parseConfig(source: string | null): Record<string, TagConfig> {
	if (!source) return {};
	try {
		const tags = asRecord(asRecord(parse(source))?.["tags"]) ?? {};
		const out: Record<string, TagConfig> = {};
		for (const [tag, raw] of Object.entries(tags)) {
			const spec = typeof raw === "string" ? { workflow: raw } : (asRecord(raw) ?? {});
			const inputs = asRecord(spec["inputs"]);
			out[tag] = {
				workflow: typeof spec["workflow"] === "string" ? spec["workflow"] : undefined,
				color: typeof spec["color"] === "string" ? spec["color"] : undefined,
				inputs: inputs ? Object.fromEntries(Object.entries(inputs).map(([k, v]) => [k, String(v)])) : undefined,
			};
		}
		return out;
	} catch {
		return {};
	}
}

const words = (s: string) =>
	s
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean);

function containsWords(haystack: string[], needle: string[]): boolean {
	if (!needle.length) return false;
	for (let i = 0; i + needle.length <= haystack.length; i++) {
		if (needle.every((w, k) => haystack[i + k] === w)) return true;
	}
	return false;
}

const fileName = (path: string) =>
	path
		.split("/")
		.pop()!
		.replace(/\.ya?ml$/, "");

export function findWorkflow(workflows: Workflow[], ref: string): Workflow | undefined {
	return workflows.find((w) => w.path === ref || w.path.endsWith(`/${ref}`) || fileName(w.path) === fileName(ref));
}

export function mentionsTag(source: string, tag: string): boolean {
	const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`(^|[\\s:'"=/])${escaped}(?=$|[\\s'"])`, "m").test(source);
}

export function matchWorkflow(
	tag: string,
	workflows: Workflow[],
	config: Record<string, TagConfig>,
	picked?: string,
): TagMatch | null {
	const usable = workflows.filter((w) => w.dispatchable);
	const preset = config[tag];
	const configured = preset?.workflow ? findWorkflow(usable, preset.workflow) : undefined;
	const extra = { inputs: preset?.inputs ?? {}, color: preset?.color };
	if (configured) return { workflow: configured, source: "config", ...extra };
	const pick = picked ? findWorkflow(usable, picked) : undefined;
	if (pick) return { workflow: pick, source: "picked", ...extra };
	const needle = words(tag);
	const byFile = usable.find((w) => containsWords(words(fileName(w.path)), needle));
	const byName = byFile ?? usable.find((w) => containsWords(words(w.name), needle));
	if (byName) return { workflow: byName, source: "name", ...extra };
	const byContent = usable.find((w) => mentionsTag(w.source, tag));
	if (byContent) return { workflow: byContent, source: "content", ...extra };
	return null;
}

export function commitInput(workflow: Workflow): WorkflowInput | undefined {
	return workflow.inputs.find((i) => COMMIT_INPUTS.includes(i.name.toLowerCase()));
}

export interface RefChoice {
	kind: "input" | "branch" | "tag" | "temporary";
	ref: string;
}

export function chooseRef(
	workflow: Workflow,
	sha: string,
	defaultBranch: string,
	branchesAt: string[],
	tagsAt: string[],
): RefChoice {
	if (commitInput(workflow)) return { kind: "input", ref: defaultBranch };
	if (branchesAt.includes(defaultBranch)) return { kind: "branch", ref: defaultBranch };
	if (branchesAt.length) return { kind: "branch", ref: branchesAt[0] };
	if (tagsAt.length) return { kind: "tag", ref: tagsAt[0] };
	return { kind: "temporary", ref: `${TEMP_PREFIX}${sha.slice(0, 7)}` };
}

export const TEMP_PREFIX = "release-line/";

export function initialInputs(workflow: Workflow, preset: Record<string, string>, sha: string): Record<string, string> {
	const values: Record<string, string> = {};
	for (const input of workflow.inputs) {
		values[input.name] = preset[input.name] ?? input.default ?? "";
		if (input.type === "choice" && !values[input.name] && input.options.length)
			values[input.name] = input.options[0];
		if (input.type === "boolean" && !values[input.name]) values[input.name] = "false";
	}
	const commit = commitInput(workflow);
	if (commit) values[commit.name] = sha;
	return values;
}

export function isBumpInput(input: WorkflowInput): boolean {
	return input.type === "choice" && ["patch", "minor", "major"].every((o) => input.options.includes(o));
}

export function autoReleaseTags(
	names: string[],
	set: { workflows: Workflow[]; config: Record<string, TagConfig> },
	picks: Record<string, string> = {},
): string[] {
	const configured = names.filter((n) => n in set.config);
	if (configured.length) return configured;
	const matched = names.filter((n) => matchWorkflow(n, set.workflows, set.config, picks[n]));
	return matched.length ? matched : names;
}
