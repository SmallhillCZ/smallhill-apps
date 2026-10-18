import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp, isShareUrl, parseListUrl, toPlaceList } from "../server/app.ts";

const LIST_ID = "tAbCdEfGhIjKlMnOpQrStUvWxYz012";

const entry = (name: string, note: string, lat: number, lng: number) => [
	null,
	[
		null,
		null,
		"",
		null,
		`${name} street 1, Praha`,
		[null, null, lat, lng],
		["5119350185142539367", "-5571610622445806068"],
		"/g/11abc",
	],
	name,
	note,
];

const RAW =
	")]}'\n" +
	JSON.stringify([
		[
			[LIST_ID, 1, null, 1, 1],
			4,
			[2, 1, `https://www.google.com/maps/placelists/list/${LIST_ID}`],
			["Owner", "https://example.com/a.png", "1"],
			"Pubs",
			"",
			null,
			null,
			[entry("U Matěje", "good dinner", 50.11, 14.37), entry("Bruska", "", 50.09, 14.4), [null, [null]]],
		],
	]);

test("accepts only Google Maps links", () => {
	assert.ok(isShareUrl("https://maps.app.goo.gl/3crmJEk16Vioi7qd6?g_st=ac"));
	assert.ok(isShareUrl(`https://www.google.com/maps/placelists/list/${LIST_ID}`));
	assert.ok(isShareUrl("https://www.google.cz/maps/@50,14,10z"));
	assert.equal(isShareUrl("https://example.com/maps/x"), null);
	assert.equal(isShareUrl("https://maps.app.goo.gl.evil.com/x"), null);
	assert.equal(isShareUrl("file:///etc/passwd"), null);
	assert.equal(isShareUrl("not a url"), null);
});

test("reads list id and token from long links", () => {
	assert.deepEqual(parseListUrl(`https://www.google.com/maps/placelists/list/${LIST_ID}?token=abc_1`), {
		id: LIST_ID,
		token: "abc_1",
	});
	assert.deepEqual(parseListUrl(`https://www.google.com/maps/@50,14,10z/data=!4m3!11m2!2s${LIST_ID}!3e3`), {
		id: LIST_ID,
		token: null,
	});
	const consent = `https://consent.google.com/m?continue=${encodeURIComponent(`https://www.google.com/maps/placelists/list/${LIST_ID}`)}`;
	assert.equal(parseListUrl(consent)?.id, LIST_ID);
	assert.equal(parseListUrl("https://www.google.com/maps/place/Somewhere"), null);
});

test("parses places with notes and unsigned CID", () => {
	const list = toPlaceList(RAW, LIST_ID, null);
	assert.equal(list.title, "Pubs");
	assert.equal(list.description, null);
	assert.deepEqual(list.owner, { name: "Owner", id: "1" });
	assert.equal(list.places.length, 2);
	assert.deepEqual(list.places[0], {
		name: "U Matěje",
		address: "U Matěje street 1, Praha",
		note: "good dinner",
		lat: 50.11,
		lng: 14.37,
		placeId: "/g/11abc",
		cid: "12875133451263745548",
	});
	assert.equal(list.places[1].note, null);
});

test("GET /api/list follows the short link and loads the list", async () => {
	const calls: string[] = [];
	const fake: typeof fetch = async (input) => {
		const url = String(input);
		calls.push(url);
		if (url.startsWith("https://maps.app.goo.gl/")) {
			return new Response(null, {
				status: 302,
				headers: { location: `https://www.google.com/maps/@50,14,10z/data=!4m3!11m2!2s${LIST_ID}!3e3` },
			});
		}
		if (url.includes("/maps/preview/entitylist/getlist")) return new Response(RAW);
		return new Response("", { status: 500 });
	};
	const app = await buildApp({ fetch: fake, basePath: "/places/" });
	const res = await app.inject({
		method: "GET",
		url: `/places/api/list?url=${encodeURIComponent("https://maps.app.goo.gl/xyz")}&lang=cs`,
	});
	assert.equal(res.statusCode, 200);
	assert.equal(res.json().title, "Pubs");
	assert.equal(res.json().places.length, 2);
	assert.match(calls[1], /hl=cs/);
	assert.match(calls[1], new RegExp(`placelists%2Flist%2F${LIST_ID}`));
});

test("GET /api/list rejects other hosts without fetching", async () => {
	let fetched = false;
	const app = await buildApp({
		fetch: async () => {
			fetched = true;
			return new Response("");
		},
	});
	const res = await app.inject({ method: "GET", url: `/api/list?url=${encodeURIComponent("http://127.0.0.1/")}` });
	assert.equal(res.statusCode, 400);
	assert.equal(fetched, false);
});

test("GET /api/list reports a link that is not a list", async () => {
	const app = await buildApp({
		fetch: async () =>
			new Response(null, { status: 302, headers: { location: "https://www.google.com/maps/place/X" } }),
	});
	const res = await app.inject({
		method: "GET",
		url: `/api/list?url=${encodeURIComponent("https://maps.app.goo.gl/abc")}`,
	});
	assert.equal(res.statusCode, 404);
	assert.equal(res.json().error, "notfound");
});
