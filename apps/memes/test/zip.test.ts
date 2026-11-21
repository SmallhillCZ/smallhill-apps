import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { deflateRawSync } from "node:zlib";
import { crc32, readZip, writeZip } from "../src/app/zip.ts";

test("crc32 matches the known check value", () => {
	assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("writeZip output reads back", async () => {
	const entries = [
		{ name: "memes.json", data: new TextEncoder().encode("[]") },
		{ name: "files/kočka.gif", data: new Uint8Array([1, 2, 3, 4, 5]) },
	];
	const back = await readZip(writeZip(entries));
	assert.deepEqual(
		back.map((e) => [e.name, [...e.data]]),
		entries.map((e) => [e.name, [...e.data]]),
	);
});

test("writeZip output is a valid zip for unzip", { skip: !hasUnzip() }, () => {
	const dir = mkdtempSync(join(tmpdir(), "memes-zip-"));
	const file = join(dir, "a.zip");
	writeFileSync(file, writeZip([{ name: "a.txt", data: new TextEncoder().encode("hello") }]));
	execFileSync("unzip", ["-tq", file]);
	execFileSync("unzip", ["-q", file, "-d", dir]);
	assert.equal(readFileSync(join(dir, "a.txt"), "utf8"), "hello");
});

test("readZip inflates deflated entries", async () => {
	const data = new TextEncoder().encode("deflate me ".repeat(50));
	const zip = writeZip([{ name: "x.txt", data }]);
	const packed = deflateRawSync(data);
	const view = new DataView(zip.buffer);
	const nameLength = 5;
	const local = zip.slice(0, 30 + nameLength);
	const lv = new DataView(local.buffer);
	lv.setUint16(8, 8, true);
	lv.setUint32(18, packed.length, true);
	const centralStart = view.getUint32(zip.length - 6, true);
	const central = zip.slice(centralStart, centralStart + 46 + nameLength);
	const cv = new DataView(central.buffer);
	cv.setUint16(10, 8, true);
	cv.setUint32(20, packed.length, true);
	const end = zip.slice(zip.length - 22);
	const ev = new DataView(end.buffer);
	ev.setUint32(16, local.length + packed.length, true);
	const rebuilt = new Uint8Array([...local, ...packed, ...central, ...end]);
	const [entry] = await readZip(rebuilt);
	assert.deepEqual([...entry.data], [...data]);
});

function hasUnzip(): boolean {
	try {
		execFileSync("unzip", ["-v"]);
		return true;
	} catch {
		return false;
	}
}
