import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import pg from "pg";
import { buildApp } from "../server/app.ts";
import { SONOS_API, SONOS_AUTH } from "../server/sonos.ts";

const pool = new pg.Pool({
	connectionString: process.env.TEST_DATABASE_URL ?? "postgres://player:player@localhost:5432/player_test",
});

interface Call {
	url: string;
	method: string;
	headers: Record<string, string>;
	body: string;
}

let calls: Call[] = [];
let expiresIn = 86400;
let tokenCount = 0;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const fakeFetch: typeof fetch = async (input, init) => {
	const call = {
		url: String(input),
		method: init?.method ?? "GET",
		headers: (init?.headers ?? {}) as Record<string, string>,
		body: String(init?.body ?? ""),
	};
	calls.push(call);
	if (call.url === `${SONOS_AUTH}/access`) {
		tokenCount++;
		return json({ access_token: `access-${tokenCount}`, refresh_token: "refresh", expires_in: expiresIn });
	}
	const path = call.url.slice(SONOS_API.length);
	if (path === "/households") return json({ households: [{ id: "HH1" }] });
	if (path === "/households/HH1/groups")
		return json({ groups: [{ id: "G1", name: "Living room", playbackState: "PLAYBACK_STATE_IDLE" }] });
	if (path === "/groups/G1/playbackSession") return json({ sessionId: "S1", sessionCreated: true });
	if (path === "/groups/G1/playback")
		return json({ playbackState: "PLAYBACK_STATE_PLAYING", itemId: "b", positionMillis: 1234 });
	if (path === "/groups/GONE/playbackSession") return json({ errorCode: "ERROR_RESOURCE_GONE" }, 410);
	return json({});
};

const app = await buildApp({
	pool,
	sonos: { clientId: "client", clientSecret: "secret", publicUrl: "https://apps.example", fetch: fakeFetch },
});
const disabled = await buildApp({ pool });

before(async () => {
	await pool.query("DROP TABLE IF EXISTS player_sonos_queues");
});
beforeEach(() => {
	calls = [];
	expiresIn = 86400;
});
after(async () => {
	await app.close();
	await disabled.close();
	await pool.end();
});

const items = [
	{ id: "a", title: "One", artist: "Artist", album: "Album", duration: 61.5, type: "audio/mpeg", url: "https://x/a" },
	{ id: "b", title: "Two", type: "audio/flac", url: "https://x/b" },
	{ id: "c", title: "Three", url: null },
];

async function connect(): Promise<string> {
	const login = await app.inject({ url: "/api/sonos/login" });
	assert.equal(login.statusCode, 302);
	const location = new URL(login.headers.location as string);
	const state = location.searchParams.get("state")!;
	assert.equal(location.searchParams.get("redirect_uri"), "https://apps.example/api/sonos/callback");
	const callback = await app.inject({
		url: `/api/sonos/callback?code=abc&state=${state}`,
		headers: { cookie: `player_sonos_state=${state}` },
	});
	assert.equal(callback.statusCode, 302);
	const target = callback.headers.location as string;
	assert.match(target, /^\/#sonos=/);
	return target.slice("/#sonos=".length);
}

async function createQueue(token: string) {
	const res = await app.inject({
		method: "POST",
		url: "/api/sonos/queues",
		headers: { "x-sonos-token": token },
		payload: { groupId: "G1", items, itemId: "b", positionMillis: 5000 },
	});
	assert.equal(res.statusCode, 201, res.body);
	return res.json() as { id: string; key: string };
}

test("without credentials Sonos is reported as disabled", async () => {
	assert.deepEqual((await disabled.inject({ url: "/api/sonos/config" })).json(), { enabled: false });
	assert.equal((await disabled.inject({ url: "/api/sonos/login" })).statusCode, 404);
	assert.equal((await disabled.inject({ url: "/api/sonos/groups" })).statusCode, 404);
	assert.deepEqual((await app.inject({ url: "/api/sonos/config" })).json(), { enabled: true });
});

test("sign-in exchanges the code server-side and hands the browser a sealed token", async () => {
	const token = await connect();
	const exchange = calls.find((c) => c.url === `${SONOS_AUTH}/access`)!;
	assert.equal(exchange.headers.Authorization, `Basic ${Buffer.from("client:secret").toString("base64")}`);
	assert.match(exchange.body, /grant_type=authorization_code/);
	assert.equal(token.includes("access-"), false);
});

test("a callback with a wrong state fails", async () => {
	const res = await app.inject({
		url: "/api/sonos/callback?code=abc&state=bad",
		headers: { cookie: "player_sonos_state=good" },
	});
	assert.equal(res.headers.location, "/#sonos-error");
	assert.equal(calls.length, 0);
});

test("lists groups and rejects a missing or forged token", async () => {
	const token = await connect();
	const res = await app.inject({ url: "/api/sonos/groups", headers: { "x-sonos-token": token } });
	assert.deepEqual(res.json(), { groups: [{ id: "G1", name: "Living room", playbackState: "PLAYBACK_STATE_IDLE" }] });
	assert.equal((await app.inject({ url: "/api/sonos/groups" })).statusCode, 401);
	const forged = await app.inject({
		url: "/api/sonos/groups",
		headers: { "x-sonos-token": `${token.slice(0, 20)}${token[20] === "A" ? "B" : "A"}${token.slice(21)}` },
	});
	assert.equal(forged.statusCode, 401);
});

test("an expiring token is refreshed and returned in a header", async () => {
	expiresIn = 60;
	const token = await connect();
	calls = [];
	const res = await app.inject({ url: "/api/sonos/groups", headers: { "x-sonos-token": token } });
	assert.equal(res.statusCode, 200);
	assert.match(calls[0].body, /grant_type=refresh_token/);
	assert.ok(res.headers["x-sonos-token"]);
});

test("starting a queue creates a session and loads the cloud queue", async () => {
	const token = await connect();
	calls = [];
	const { id, key } = await createQueue(token);
	const session = calls.find((c) => c.url.endsWith("/groups/G1/playbackSession"))!;
	assert.deepEqual(JSON.parse(session.body), { appId: "cz.smallhill.player", appContext: id });
	const load = calls.find((c) => c.url.endsWith("/playbackSessions/S1/playbackSession/loadCloudQueue"))!;
	const body = JSON.parse(load.body);
	assert.equal(body.queueBaseUrl, `https://apps.example/api/sonos/cq/${id}/v2.3/`);
	assert.equal(body.httpAuthorization, `Bearer ${key}`);
	assert.equal(body.itemId, "b");
	assert.equal(body.positionMillis, 5000);
	assert.equal(body.playOnCompletion, true);
	assert.equal(body.trackMetadata.mediaUrl, `https://apps.example/api/sonos/cq/${id}/media/b`);
	assert.equal(body.trackMetadata.contentType, "audio/flac");
});

test("the cloud queue serves context, item windows and media to players with the queue key", async () => {
	const { id, key } = await createQueue(await connect());
	const auth = { authorization: `Bearer ${key}` };
	const base = `/api/sonos/cq/${id}/v2.3`;

	assert.equal((await app.inject({ url: `${base}/context` })).statusCode, 401);
	assert.equal(
		(await app.inject({ url: `${base}/context`, headers: { authorization: "Bearer x" } })).statusCode,
		401,
	);

	const context = (await app.inject({ url: `${base}/context`, headers: auth })).json();
	assert.equal(context.queueVersion, "1");

	const window = (
		await app.inject({
			url: `${base}/itemWindow?itemId=b&previousWindowSize=1&upcomingWindowSize=0`,
			headers: auth,
		})
	).json();
	assert.equal(window.includesBeginningOfQueue, true);
	assert.equal(window.includesEndOfQueue, false);
	assert.deepEqual(
		window.items.map((i: { id: string }) => i.id),
		["a", "b"],
	);
	assert.equal(window.items[0].track.durationMillis, 61500);
	assert.deepEqual(window.items[0].track.artist, { name: "Artist" });

	const first = (await app.inject({ url: `${base}/itemWindow?itemId=`, headers: auth })).json();
	assert.equal(first.items[0].id, "a");
	assert.equal(first.includesEndOfQueue, true);

	assert.deepEqual((await app.inject({ url: `${base}/version`, headers: auth })).json(), {
		contextVersion: "1",
		queueVersion: "1",
	});
	assert.equal((await app.inject({ method: "POST", url: `${base}/timePlayed`, headers: auth })).statusCode, 200);

	const media = await app.inject({ url: `/api/sonos/cq/${id}/media/a` });
	assert.equal(media.statusCode, 302);
	assert.equal(media.headers.location, "https://x/a");
	assert.equal((await app.inject({ url: `/api/sonos/cq/${id}/media/c` })).statusCode, 404);
});

test("updating media URLs keeps the version, changing tracks bumps it and refreshes Sonos", async () => {
	const token = await connect();
	const { id, key } = await createQueue(token);
	const headers = { "x-queue-key": key, "x-sonos-token": token };
	calls = [];

	const urls = await app.inject({
		method: "PUT",
		url: `/api/sonos/queues/${id}`,
		headers,
		payload: { items: items.map((i) => ({ ...i, url: `https://y/${i.id}` })) },
	});
	assert.deepEqual(urls.json(), { version: 1 });
	assert.equal(calls.length, 0);

	const added = await app.inject({
		method: "PUT",
		url: `/api/sonos/queues/${id}`,
		headers,
		payload: { items: [...items, { id: "d", title: "Four", url: "https://x/d" }] },
	});
	assert.deepEqual(added.json(), { version: 2 });
	assert.ok(calls.some((c) => c.url.endsWith("/playbackSessions/S1/playbackSession/refreshCloudQueue")));

	const wrongKey = await app.inject({
		method: "PUT",
		url: `/api/sonos/queues/${id}`,
		headers: { ...headers, "x-queue-key": "nope" },
		payload: { items },
	});
	assert.equal(wrongKey.statusCode, 404);
});

test("controls and status go to the group of the queue", async () => {
	const token = await connect();
	const { id, key } = await createQueue(token);
	const headers = { "x-queue-key": key, "x-sonos-token": token };
	calls = [];

	const control = (payload: object) =>
		app.inject({ method: "POST", url: `/api/sonos/queues/${id}/control`, headers, payload });
	assert.equal((await control({ action: "pause" })).statusCode, 200);
	assert.equal((await control({ action: "seek", positionMillis: 3000, itemId: "a" })).statusCode, 200);
	assert.equal((await control({ action: "skipToItem", itemId: "c", play: false })).statusCode, 200);
	assert.equal((await control({ action: "skipToItem" })).statusCode, 400);
	assert.equal((await control({ action: "explode" })).statusCode, 400);

	assert.ok(calls[0].url.endsWith("/groups/G1/playback/pause"));
	assert.deepEqual(JSON.parse(calls[1].body), { positionMillis: 3000, itemId: "a" });
	assert.deepEqual(JSON.parse(calls[2].body), {
		itemId: "c",
		queueVersion: "1",
		positionMillis: 0,
		playOnCompletion: false,
	});

	const status = await app.inject({ url: `/api/sonos/queues/${id}/status`, headers });
	assert.deepEqual(status.json(), { state: "PLAYBACK_STATE_PLAYING", itemId: "b", positionMillis: 1234 });

	assert.equal(
		(await app.inject({ method: "DELETE", url: `/api/sonos/queues/${id}`, headers: { "x-queue-key": key } }))
			.statusCode,
		204,
	);
	assert.equal((await app.inject({ url: `/api/sonos/queues/${id}/status`, headers })).statusCode, 404);
});

test("a group that is gone is reported as such", async () => {
	const res = await app.inject({
		method: "POST",
		url: "/api/sonos/queues",
		headers: { "x-sonos-token": await connect() },
		payload: { groupId: "GONE", items, itemId: "a" },
	});
	assert.equal(res.statusCode, 410);
});
