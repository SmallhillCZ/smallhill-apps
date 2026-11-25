import assert from "node:assert/strict";
import { test } from "node:test";
import QRCode from "qrcode";
import { buildApp, encodeSession } from "../server/app.ts";
import { qrMatrix, watchLanguage, WATCH_RESULT_URL } from "../server/watch.ts";

function unpack(size: number, qr: string) {
	const bits = Buffer.from(qr, "base64");
	return Array.from({ length: size * size }, (_, i) => (bits[i >> 3] >> (7 - (i & 7))) & 1);
}

test("QR image becomes a module matrix with the same payload", async () => {
	const dataUrl = await QRCode.toDataURL("7032805057050", { errorCorrectionLevel: "H", scale: 6, margin: 4 });
	const m = qrMatrix(dataUrl);
	assert.ok(m);
	const { modules } = QRCode.create([{ data: Buffer.from("7032805057050"), mode: "byte" }], {
		errorCorrectionLevel: "M",
	});
	assert.equal(m.size, modules.size);
	assert.deepEqual(
		unpack(m.size, m.qr),
		Array.from({ length: modules.size ** 2 }, (_, i) =>
			modules.get(Math.floor(i / modules.size), i % modules.size) ? 1 : 0,
		),
	);
	assert.equal(qrMatrix("data:image/png;base64,AAAA"), null);
	assert.equal(qrMatrix("data:image/gif;base64,AAAA"), null);
});

test("watch login page follows the phone language and redirects to the watch", async () => {
	assert.equal(watchLanguage("cs-CZ,cs;q=0.9,en;q=0.8"), "cs");
	assert.equal(watchLanguage("de-DE,en;q=0.5"), "en");
	assert.equal(watchLanguage(undefined), "en");
	const app = await buildApp({ basePath: "/tickets" });
	const res = await app.inject({ url: "/tickets/api/watch/login", headers: { "accept-language": "cs" } });
	assert.equal(res.statusCode, 200);
	assert.match(res.headers["content-type"] as string, /text\/html/);
	assert.match(res.body, /Přihlásit/);
	assert.ok(res.body.includes(WATCH_RESULT_URL));
});

test("watch tickets carry QR matrices and the refreshed session in the body", async () => {
	const qr = await QRCode.toDataURL("ABC-1", { scale: 5 });
	const html = `<html><div class="code"><img src="${qr}" class="qrcode"/><div class="code">ABC-1</div></div></html>`;
	const seen: string[] = [];
	const fetch = (async (input: URL | string) => {
		const url = new URL(String(input));
		seen.push(url.pathname);
		if (url.pathname.startsWith("/services/saleform/purchase/v2/list"))
			return new Response(
				JSON.stringify({
					purchases: {
						"1": { id: 1, eventId: 1, scheduleId: 1, venueId: 1, paid: true, url: { mobile: "/m/a" } },
						"2": {
							id: 2,
							eventId: 1,
							scheduleId: 1,
							venueId: 1,
							paid: true,
							url: { mobile: "https://evil.example/m" },
						},
					},
					schedules: { "1": { startISO8601: "2030-01-01T20:00:00+01:00" } },
					events: { "1": { name: "Concert" } },
					venues: { "1": { name: "Club" } },
				}),
				{ headers: { "content-type": "application/json", "set-cookie": "token=new; Path=/" } },
			);
		if (url.pathname === "/m/a") return new Response(html, { headers: { "content-type": "text/html" } });
		return new Response("", { status: 404 });
	}) as typeof globalThis.fetch;
	const app = await buildApp({ fetch });
	assert.equal((await app.inject({ url: "/api/watch/tickets" })).statusCode, 401);
	const res = await app.inject({
		url: "/api/watch/tickets",
		headers: { "x-goout-session": encodeSession({ token: "old" }) },
	});
	assert.equal(res.statusCode, 200);
	const body = res.json();
	assert.equal(body.session, encodeSession({ token: "new" }));
	assert.equal(body.tickets.length, 2);
	const [a, b] = body.tickets;
	assert.equal(a.name, "Concert");
	assert.equal(a.codes.length, 1);
	assert.equal(a.codes[0].code, "ABC-1");
	assert.ok(a.codes[0].size >= 21);
	assert.equal(typeof a.codes[0].qr, "string");
	assert.deepEqual(b.codes, []);
	assert.ok(!seen.includes("/m"));
});
