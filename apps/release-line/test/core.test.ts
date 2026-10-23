import assert from "node:assert/strict";
import { test } from "node:test";
import { edgePath, layout, topoSort } from "../src/app/core/graph.ts";
import {
	bumpVersion,
	latestVersion,
	matchesFilter,
	parseFilter,
	releaseTagNames,
	tagColor,
} from "../src/app/core/tags.ts";
import {
	autoReleaseTags,
	chooseRef,
	initialInputs,
	isBumpInput,
	matchWorkflow,
	mentionsTag,
	parseConfig,
	parseWorkflow,
} from "../src/app/core/workflows.ts";

const c = (oid: string, date: string, ...parents: string[]) => ({ oid, date, parents });

test("topoSort puts children before parents and newest first", () => {
	const commits = [c("a", "1"), c("b", "2", "a"), c("x", "3", "a"), c("m", "4", "b", "x")];
	assert.deepEqual(
		topoSort(commits).map((x) => x.oid),
		["m", "x", "b", "a"],
	);
});

test("layout keeps the main branch in lane 0 and puts merged branches beside it", () => {
	const commits = [
		c("a", "2026-01-01", "z"),
		c("f1", "2026-01-02", "a"),
		c("b", "2026-01-03", "a"),
		c("f2", "2026-01-04", "f1"),
		c("m", "2026-01-05", "b", "f2"),
		c("open", "2026-01-06", "b"),
		c("side", "2026-01-07", "open", "elsewhere"),
	];
	const g = layout(commits, "m");
	const lane = (oid: string) => g.nodes.find((n) => n.commit.oid === oid)!.lane;
	assert.equal(lane("m"), 0);
	assert.equal(lane("b"), 0);
	assert.equal(lane("a"), 0);
	assert.equal(lane("f2"), lane("f1"));
	assert.notEqual(lane("f2"), 0);
	assert.notEqual(lane("open"), 0);
	const outside = g.edges.find((e) => e.toRow === null);
	assert.ok(outside);
	assert.equal(outside.lane, 0);
	assert.ok(g.lanes >= 2);
	assert.equal(g.edges.filter((e) => e.toRow === null).length, 1);
});

test("edgePath draws straight lines in a lane and curves between lanes", () => {
	const geo = { row: 50, lane: 20, pad: 10 };
	assert.equal(edgePath({ fromRow: 0, fromLane: 0, lane: 0, toRow: 2, toLane: 0 }, geo, 500), "M 10 25 L 10 125");
	assert.match(edgePath({ fromRow: 0, fromLane: 1, lane: 1, toRow: 3, toLane: 0 }, geo, 500), /L 30 125 C/);
	assert.equal(edgePath({ fromRow: 0, fromLane: 0, lane: 0, toRow: null, toLane: 0 }, geo, 500), "M 10 25 L 10 75");
	assert.equal(edgePath({ fromRow: 9, fromLane: 1, lane: 1, toRow: null, toLane: 1 }, geo, 500), "M 30 475 L 30 500");
});

test("tag filters and release tags", () => {
	const names = ["NEXT", "PRODUCTION", "v4.26.12", "v4.26.9", "old-thing"];
	assert.deepEqual(parseFilter("NEXT, PRODUCTION  v*"), ["NEXT", "PRODUCTION", "v*"]);
	assert.ok(matchesFilter("v4.26.12", ["v*"]));
	assert.ok(!matchesFilter("NEXTGEN", ["NEXT"]));
	assert.deepEqual(releaseTagNames(names, []), ["NEXT", "PRODUCTION", "old-thing"]);
	assert.deepEqual(releaseTagNames(names, ["NEXT", "PRODUCTION", "v*"]), ["NEXT", "PRODUCTION"]);
});

test("versions", () => {
	assert.equal(latestVersion(["v4.26.9", "v4.26.12", "v4.3.0", "v5.0.0-next.1", "NEXT"]), "v4.26.12");
	assert.equal(bumpVersion("v4.26.12", "patch"), "v4.26.13");
	assert.equal(bumpVersion("v4.26.12", "minor"), "v4.27.0");
	assert.equal(bumpVersion("v4.26.12", "major"), "v5.0.0");
	assert.equal(bumpVersion("v4.26.12", "none"), "v4.26.12");
	assert.equal(bumpVersion(null, "minor"), "v0.1.0");
});

test("tag colours", () => {
	assert.equal(tagColor("PRODUCTION"), "#2b8a3e");
	assert.equal(tagColor("NEXT"), "#f59f00");
	assert.equal(tagColor("NEXT", "#123456"), "#123456");
});

const production = `name: Release to PRODUCTION
on:
  workflow_dispatch:
    inputs:
      semver:
        description: "Version bump"
        required: true
        type: choice
        default: none
        options: [none, patch, minor, major]
jobs:
  tag:
    uses: ./.github/workflows/tag.yml
    with:
      tag: PRODUCTION
`;
const next = `name: Release to NEXT
on:
  workflow_dispatch:
jobs:
  tag:
    with:
      tag: NEXT
`;
const deploy = `name: Ship it
on: [workflow_dispatch]
jobs:
  tag:
    steps:
      - run: git tag -f STAGING && git push -f origin STAGING
`;
const build = `name: Build
on:
  workflow_call:
    inputs:
      tag: { type: string }
`;

const workflows = [
	parseWorkflow({ id: 1, name: "Build", path: ".github/workflows/build.yml" }, build),
	parseWorkflow({ id: 2, name: "Release to NEXT", path: ".github/workflows/release-next.yml" }, next),
	parseWorkflow(
		{ id: 3, name: "Release to PRODUCTION", path: ".github/workflows/release-production.yml" },
		production,
	),
	parseWorkflow({ id: 4, name: "Ship it", path: ".github/workflows/ship.yml" }, deploy),
];

test("parseWorkflow reads dispatch inputs", () => {
	const prod = workflows[2];
	assert.ok(prod.dispatchable);
	assert.deepEqual(prod.inputs[0].options, ["none", "patch", "minor", "major"]);
	assert.equal(prod.inputs[0].default, "none");
	assert.ok(isBumpInput(prod.inputs[0]));
	assert.ok(!workflows[0].dispatchable);
	assert.ok(workflows[3].dispatchable);
});

test("matchWorkflow: config, pick, name, content", () => {
	assert.equal(matchWorkflow("PRODUCTION", workflows, {})?.workflow.id, 3);
	assert.equal(matchWorkflow("PRODUCTION", workflows, {})?.source, "name");
	assert.equal(matchWorkflow("NEXT", workflows, {})?.workflow.id, 2);
	assert.equal(matchWorkflow("STAGING", workflows, {})?.source, "content");
	assert.equal(matchWorkflow("STAGING", workflows, {})?.workflow.id, 4);
	assert.equal(matchWorkflow("OTHER", workflows, {}), null);
	assert.equal(matchWorkflow("NEXT", workflows, {}, "ship.yml")?.source, "picked");
	const config = parseConfig(
		"tags:\n  NEXT:\n    workflow: release-production.yml\n    inputs:\n      semver: patch\n",
	);
	const m = matchWorkflow("NEXT", workflows, config, "ship.yml");
	assert.equal(m?.source, "config");
	assert.equal(m?.workflow.id, 3);
	assert.deepEqual(m?.inputs, { semver: "patch" });
	assert.ok(mentionsTag(production, "PRODUCTION"));
	assert.ok(!mentionsTag(production, "PROD"));
});

test("chooseRef prefers a commit input, then existing refs, then a temporary branch", () => {
	const withInput = parseWorkflow(
		{ id: 9, name: "x", path: "x.yml" },
		"on:\n  workflow_dispatch:\n    inputs:\n      sha:\n        type: string\n",
	);
	assert.deepEqual(chooseRef(withInput, "abcdef123", "master", [], []), { kind: "input", ref: "master" });
	assert.equal(initialInputs(withInput, {}, "abcdef123")["sha"], "abcdef123");
	assert.deepEqual(chooseRef(workflows[2], "abcdef123", "master", ["master", "x"], ["NEXT"]), {
		kind: "branch",
		ref: "master",
	});
	assert.deepEqual(chooseRef(workflows[2], "abcdef123", "master", [], ["NEXT"]), { kind: "tag", ref: "NEXT" });
	assert.deepEqual(chooseRef(workflows[2], "abcdef123", "master", [], []), {
		kind: "temporary",
		ref: "release-line/abcdef1",
	});
});

test("autoReleaseTags keeps tags that have a workflow", () => {
	const set = { workflows, config: {} };
	assert.deepEqual(autoReleaseTags(["NEXT", "PRODUCTION", "PROD"], set), ["NEXT", "PRODUCTION"]);
	assert.deepEqual(autoReleaseTags(["OLD", "PROD"], set), ["OLD", "PROD"]);
	assert.deepEqual(autoReleaseTags(["NEXT", "X"], { workflows, config: parseConfig("tags:\n  X: ship.yml\n") }), [
		"X",
	]);
});
