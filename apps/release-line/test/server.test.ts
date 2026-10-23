import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../server/app.ts";

function fakeGithub(handler: (url: URL, body: Record<string, string>) => Response) {
	const calls: { url: string; body: Record<string, string> }[] = [];
	const fetch = (async (input: URL | string, init: RequestInit = {}) => {
		const body = JSON.parse(String(init.body ?? "{}"));
		calls.push({ url: String(input), body });
		return handler(new URL(String(input)), body);
	}) as typeof globalThis.fetch;
	return { calls, fetch };
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("reports whether device flow is available", async () => {
	const on = await buildApp({ clientId: "abc", basePath: "/release-line/" });
	assert.deepEqual((await on.inject({ url: "/release-line/api/auth" })).json(), { deviceFlow: true });
	const off = await buildApp({ clientId: "" });
	assert.deepEqual((await off.inject({ url: "/api/auth" })).json(), { deviceFlow: false });
	assert.equal((await off.inject({ method: "POST", url: "/api/device/code" })).statusCode, 404);
});

test("requests a device code with the app's client id", async () => {
	const gh = fakeGithub(() =>
		json({
			device_code: "dev",
			user_code: "WDJB-MJHT",
			verification_uri: "https://github.com/login/device",
			expires_in: 900,
			interval: 5,
		}),
	);
	const app = await buildApp({ clientId: "abc", fetch: gh.fetch });
	const res = await app.inject({ method: "POST", url: "/api/device/code" });
	assert.equal(res.statusCode, 200);
	assert.deepEqual(res.json(), {
		deviceCode: "dev",
		userCode: "WDJB-MJHT",
		verificationUri: "https://github.com/login/device",
		expiresIn: 900,
		interval: 5,
	});
	assert.equal(gh.calls[0].url, "https://github.com/login/device/code");
	assert.deepEqual(gh.calls[0].body, { client_id: "abc", scope: "repo" });
});

test("exchanges the device code for a token and passes pending states through", async () => {
	let ready = false;
	const gh = fakeGithub(() => (ready ? json({ access_token: "gho_x" }) : json({ error: "authorization_pending" })));
	const app = await buildApp({ clientId: "abc", fetch: gh.fetch });
	const pending = await app.inject({ method: "POST", url: "/api/device/token", payload: { deviceCode: "dev" } });
	assert.deepEqual(pending.json(), { error: "authorization_pending" });
	ready = true;
	const done = await app.inject({ method: "POST", url: "/api/device/token", payload: { deviceCode: "dev" } });
	assert.deepEqual(done.json(), { token: "gho_x" });
	assert.equal(done.headers["cache-control"], "no-store");
	assert.equal(gh.calls[1].body["grant_type"], "urn:ietf:params:oauth:grant-type:device_code");
	assert.equal(gh.calls[1].body["client_id"], "abc");
	const bad = await app.inject({ method: "POST", url: "/api/device/token", payload: { other: 1 } });
	assert.equal(bad.statusCode, 400);
});

test("reports GitHub failures as 502", async () => {
	const gh = fakeGithub(() => new Response("oops", { status: 500 }));
	const app = await buildApp({ clientId: "abc", fetch: gh.fetch });
	assert.equal((await app.inject({ method: "POST", url: "/api/device/code" })).statusCode, 502);
});
