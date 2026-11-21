import assert from "node:assert/strict";
import { test } from "node:test";
import {
	UNTAGGED,
	addTags,
	extensionOf,
	fileName,
	matches,
	parseTags,
	sortMemes,
	tagCounts,
	titleFromName,
	typeOf,
	type MemeMeta,
} from "../src/app/library.ts";

function meme(overrides: Partial<MemeMeta>): MemeMeta {
	return { id: "a", type: "image/png", name: "", title: "", tags: [], added: 0, used: 0, uses: 0, ...overrides };
}

test("parseTags splits, trims, lowercases and dedupes", () => {
	assert.deepEqual(parseTags(" Cat, monday ;#Cat\n  work  life "), ["cat", "monday", "work life"]);
	assert.deepEqual(parseTags(" , "), []);
});

test("addTags keeps order and skips duplicates", () => {
	assert.deepEqual(addTags(["a", "b"], ["b", "c"]), ["a", "b", "c"]);
});

test("titleFromName strips extension and separators", () => {
	assert.equal(titleFromName("distracted_boyfriend-final.jpg"), "distracted boyfriend final");
});

test("matches search words in title and tags ignoring case and diacritics", () => {
	const m = meme({ title: "Pondělní kočka", tags: ["práce", "cat"] });
	assert.ok(matches(m, "pondelni", []));
	assert.ok(matches(m, "KOČ prace", []));
	assert.ok(!matches(m, "dog", []));
	assert.ok(matches(m, "", ["cat"]));
	assert.ok(!matches(m, "", ["cat", "dog"]));
	assert.ok(!matches(m, "", [UNTAGGED]));
	assert.ok(matches(meme({}), "", [UNTAGGED]));
});

test("sortMemes puts recently used or added first", () => {
	const sorted = sortMemes([
		meme({ id: "old", added: 1 }),
		meme({ id: "used", added: 2, used: 10 }),
		meme({ id: "new", added: 5 }),
	]);
	assert.deepEqual(
		sorted.map((m) => m.id),
		["used", "new", "old"],
	);
});

test("tagCounts orders by count then name", () => {
	assert.deepEqual(tagCounts([meme({ tags: ["b", "a"] }), meme({ tags: ["b"] })]), [
		{ tag: "b", count: 2 },
		{ tag: "a", count: 1 },
	]);
});

test("file names and types", () => {
	assert.equal(
		fileName(meme({ title: "Když to konečně funguje!", type: "image/gif" })),
		"kdyz-to-konecne-funguje.gif",
	);
	assert.equal(fileName(meme({ title: "", type: "video/mp4" })), "meme.mp4");
	assert.equal(extensionOf("application/octet-stream", "x.WEBP"), "webp");
	assert.equal(typeOf("clip.mp4", "application/octet-stream"), "video/mp4");
	assert.equal(typeOf("a.jpeg"), "image/jpeg");
	assert.equal(typeOf("a.gif", "image/gif"), "image/gif");
});
