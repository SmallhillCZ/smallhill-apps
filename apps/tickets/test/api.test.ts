import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp, decodeSession, encodeSession, toTickets } from "../server/app.ts";

type Call = { url: string; init: RequestInit };

function fakeGoout(handler: (url: URL, init: RequestInit) => Response) {
	const calls: Call[] = [];
	const fetch = (async (input: URL | string, init: RequestInit = {}) => {
		calls.push({ url: String(input), init });
		return handler(new URL(String(input)), init);
	}) as typeof globalThis.fetch;
	return { calls, fetch };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
	new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const list = {
	purchases: {
		"2": {
			id: 2,
			eventId: 20,
			scheduleId: 200,
			venueId: 2000,
			ticketCount: 1,
			paid: true,
			voucher: false,
			url: { pdf: "/ticket/b/pdf", mobile: null },
		},
		"1": {
			id: 1,
			eventId: 10,
			scheduleId: 100,
			venueId: 1000,
			ticketCount: 2,
			paid: true,
			voucher: false,
			url: { pdf: "/ticket/a/pdf", mobile: "https://goout.net/m/a" },
		},
		"3": {
			id: 3,
			eventId: 10,
			scheduleId: 100,
			venueId: 1000,
			ticketCount: 1,
			paid: false,
			voucher: false,
			url: {},
		},
	},
	schedules: {
		"100": { url: "/e/100", startISO8601: "2030-01-01T20:00:00+01:00", endISO8601: "2030-01-01T23:00:00+01:00" },
		"200": { url: "/e/200", startISO8601: "2030-02-01T00:00:00+01:00", hourIgnore: true },
	},
	events: { "10": { name: "Concert" }, "20": { name: "Festival" } },
	venues: { "1000": { name: "Club", url: "/v" }, "2000": { name: "Park", url: "/v2" } },
};

test("session round-trips and rejects junk", () => {
	const s = encodeSession({ token: "abc", other: "x=y" });
	assert.deepEqual(decodeSession(s), { token: "abc", other: "x=y" });
	assert.equal(decodeSession("not base64 json"), null);
	assert.equal(decodeSession(encodeSession({ "bad;name": "x" })), null);
	assert.equal(decodeSession(undefined), null);
});

test("maps paid purchases to tickets sorted by start", () => {
	const tickets = toTickets(list, "https://goout.net");
	assert.deepEqual(
		tickets.map((t) => [t.id, t.name, t.venue, t.count, t.hasTime, t.pdf]),
		[
			["1", "Concert", "Club", 2, true, "https://goout.net/ticket/a/pdf"],
			["2", "Festival", "Park", 1, false, "https://goout.net/ticket/b/pdf"],
		],
	);
	assert.equal(tickets[0].mobile, "https://goout.net/m/a");
});

test("login forwards credentials once and returns only the GoOut cookies", async () => {
	const goout = fakeGoout((url, init) => {
		assert.equal(url.pathname, "/services/user/auth/v2/login");
		const body = JSON.parse(String(init.body));
		if (body.password !== "secret") return json({ status: 401 }, 401);
		const res = json({});
		res.headers.append("set-cookie", "accessToken=AT; Path=/; HttpOnly");
		res.headers.append("set-cookie", "refreshToken=RT; Path=/; HttpOnly");
		return res;
	});
	const app = await buildApp({ fetch: goout.fetch });
	const bad = await app.inject({ method: "POST", url: "/api/login", payload: { email: "a@b.cz", password: "nope" } });
	assert.equal(bad.statusCode, 401);
	const ok = await app.inject({
		method: "POST",
		url: "/api/login",
		payload: { email: " a@b.cz ", password: "secret" },
	});
	assert.equal(ok.statusCode, 200);
	assert.deepEqual(decodeSession(ok.json().session), { accessToken: "AT", refreshToken: "RT" });
	assert.deepEqual(JSON.parse(String(goout.calls[1].init.body)), { username: "a@b.cz", password: "secret" });
	await app.close();
});

test("tickets need a session, send cookies and pass refreshed cookies back", async () => {
	const goout = fakeGoout((url, init) => {
		assert.equal(url.pathname, "/services/saleform/purchase/v2/list");
		assert.equal((init.headers as Record<string, string>).Cookie, "accessToken=AT");
		const res = json(list);
		res.headers.append("set-cookie", "accessToken=AT2; Path=/");
		return res;
	});
	const app = await buildApp({ fetch: goout.fetch, basePath: "/tickets/" });
	assert.equal((await app.inject({ url: "/tickets/api/tickets" })).statusCode, 401);
	const res = await app.inject({
		url: "/tickets/api/tickets",
		headers: { "x-goout-session": encodeSession({ accessToken: "AT" }) },
	});
	assert.equal(res.statusCode, 200);
	assert.equal(res.json().tickets.length, 2);
	assert.deepEqual(decodeSession(res.headers["x-goout-session"]), { accessToken: "AT2" });
	await app.close();
});

test("expired GoOut session becomes 401", async () => {
	const goout = fakeGoout(() => json({ status: 401 }, 401));
	const app = await buildApp({ fetch: goout.fetch });
	const res = await app.inject({ url: "/api/tickets", headers: { "x-goout-session": encodeSession({ a: "b" }) } });
	assert.equal(res.statusCode, 401);
	await app.close();
});

test("ticket file is fetched only from GoOut and HTML means it was emailed", async () => {
	const goout = fakeGoout((url) => {
		if (url.pathname === "/ticket/a/pdf")
			return new Response("%PDF-1.4", { headers: { "content-type": "application/pdf" } });
		if (url.pathname === "/ticket/r")
			return new Response(null, { status: 302, headers: { location: "/ticket/a/pdf" } });
		return new Response("<html>sent</html>", { headers: { "content-type": "text/html" } });
	});
	const app = await buildApp({ fetch: goout.fetch });
	const headers = { "x-goout-session": encodeSession({ a: "b" }) };
	const get = (url: string) => app.inject({ url: `/api/ticket?url=${encodeURIComponent(url)}`, headers });
	assert.equal((await get("https://evil.example/ticket/a/pdf")).statusCode, 400);
	const pdf = await get("https://goout.net/ticket/r");
	assert.equal(pdf.statusCode, 200);
	assert.equal(pdf.headers["content-type"], "application/pdf");
	assert.equal(pdf.body, "%PDF-1.4");
	const emailed = await get("https://goout.net/ticket/other");
	assert.equal(emailed.statusCode, 202);
	assert.equal(emailed.json().error, "emailed");
	await app.close();
});
