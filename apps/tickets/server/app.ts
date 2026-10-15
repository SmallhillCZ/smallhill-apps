import { existsSync } from "node:fs";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";

export interface AppOptions {
	basePath?: string;
	webRoot?: string;
	logger?: boolean;
	gooutUrl?: string;
	fetch?: typeof fetch;
}

export interface Ticket {
	id: string;
	name: string;
	venue: string;
	start: string | null;
	end: string | null;
	hasTime: boolean;
	count: number;
	paid: boolean;
	pdf: string | null;
	mobile: string | null;
}

type Cookies = Record<string, string>;

const SESSION_HEADER = "x-goout-session";
const USER_AGENT =
	"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36";

export const encodeSession = (cookies: Cookies) => Buffer.from(JSON.stringify(cookies)).toString("base64url");

export function decodeSession(value: unknown): Cookies | null {
	if (typeof value !== "string" || !value || value.length > 16384) return null;
	try {
		const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
		const cookies: Cookies = {};
		for (const [k, v] of Object.entries(parsed)) {
			if (typeof v === "string" && /^[\w.-]+$/.test(k) && !/[;\r\n]/.test(v)) cookies[k] = v;
		}
		return Object.keys(cookies).length ? cookies : null;
	} catch {
		return null;
	}
}

function mergeSetCookies(cookies: Cookies, res: Response): { cookies: Cookies; changed: boolean } {
	const next = { ...cookies };
	let changed = false;
	for (const line of res.headers.getSetCookie()) {
		const pair = line.split(";")[0];
		const eq = pair.indexOf("=");
		if (eq < 1) continue;
		const name = pair.slice(0, eq).trim();
		const value = pair.slice(eq + 1).trim();
		const expired = /max-age=0\b/i.test(line) || /expires=Thu, 01 Jan 1970/i.test(line) || value === "";
		if (expired) {
			if (name in next) {
				delete next[name];
				changed = true;
			}
		} else if (next[name] !== value) {
			next[name] = value;
			changed = true;
		}
	}
	return { cookies: next, changed };
}

const cookieHeader = (cookies: Cookies) =>
	Object.entries(cookies)
		.map(([k, v]) => `${k}=${v}`)
		.join("; ");

type Purchase = {
	id: number | string;
	eventId: number | string;
	scheduleId: number | string;
	venueId: number | string;
	ticketCount?: number;
	paid?: boolean;
	voucher?: boolean;
	url?: { pdf?: string | null; mobile?: string | null };
};

type PurchaseList = {
	purchases?: Record<string, Purchase>;
	schedules?: Record<string, { startISO8601?: string | null; endISO8601?: string | null; hourIgnore?: boolean }>;
	events?: Record<string, { name?: string }>;
	venues?: Record<string, { name?: string }>;
};

export function toTickets(data: PurchaseList, origin: string): Ticket[] {
	const abs = (u: string | null | undefined) => (u ? new URL(u, origin).toString() : null);
	return Object.values(data.purchases ?? {})
		.filter((p) => p.paid && !p.voucher)
		.map((p) => {
			const schedule = data.schedules?.[String(p.scheduleId)] ?? {};
			return {
				id: String(p.id),
				name: data.events?.[String(p.eventId)]?.name ?? "",
				venue: data.venues?.[String(p.venueId)]?.name ?? "",
				start: schedule.startISO8601 ?? null,
				end: schedule.endISO8601 ?? null,
				hasTime: !schedule.hourIgnore,
				count: p.ticketCount ?? 1,
				paid: !!p.paid,
				pdf: abs(p.url?.pdf),
				mobile: abs(p.url?.mobile),
			};
		})
		.sort((a, b) => (a.start ?? "9999").localeCompare(b.start ?? "9999"));
}

export interface TicketCode {
	image: string;
	code: string;
}

export function parseMobileTicket(html: string): TicketCode[] {
	const images = [
		...html.matchAll(/<img\b[^>]*\bsrc="(data:image\/(?:png|gif|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+)"[^>]*>/g),
	]
		.filter((m) => /class="[^"]*qrcode/.test(m[0]))
		.map((m) => ({ image: m[1], index: m.index ?? 0 }));
	return images.map(({ image, index }, i) => {
		const until = images[i + 1]?.index ?? html.length;
		const code = /<div class="code">\s*([^<]*?)\s*<\/div>/.exec(html.slice(index, until))?.[1] ?? "";
		return { image, code };
	});
}

export async function buildApp({
	basePath = "",
	webRoot,
	logger = false,
	gooutUrl = "https://goout.net",
	fetch: doFetch = fetch,
}: AppOptions = {}): Promise<FastifyInstance> {
	const app = Fastify({ logger: logger ? { level: "warn" } : false, bodyLimit: 16 * 1024 });
	const base = basePath.replace(/\/+$/, "");
	const api = `${base}/api`;
	const goout = new URL(gooutUrl);

	const call = (path: string, cookies: Cookies, init: RequestInit = {}) =>
		doFetch(new URL(path, goout), {
			...init,
			redirect: "manual",
			headers: {
				"User-Agent": USER_AGENT,
				Accept: "application/json, */*",
				...(Object.keys(cookies).length ? { Cookie: cookieHeader(cookies) } : {}),
				...(init.headers as Record<string, string> | undefined),
			},
		});

	function session(req: FastifyRequest, reply: FastifyReply): Cookies | null {
		const cookies = decodeSession(req.headers[SESSION_HEADER]);
		if (!cookies) reply.code(401).send({ error: "login" });
		return cookies;
	}

	function refresh(reply: FastifyReply, cookies: Cookies, res: Response) {
		const merged = mergeSetCookies(cookies, res);
		if (merged.changed) reply.header(SESSION_HEADER, encodeSession(merged.cookies));
	}

	app.post<{ Body: { email: string; password: string } }>(
		`${api}/login`,
		{
			schema: {
				body: {
					type: "object",
					required: ["email", "password"],
					additionalProperties: false,
					properties: {
						email: { type: "string", minLength: 1, maxLength: 320 },
						password: { type: "string", minLength: 1, maxLength: 1024 },
					},
				},
			},
		},
		async (req, reply) => {
			const res = await call(
				"/services/user/auth/v2/login",
				{},
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ username: req.body.email.trim(), password: req.body.password }),
				},
			);
			if (res.status === 401 || res.status === 403 || res.status === 400) {
				return reply.code(401).send({ error: "credentials" });
			}
			if (!res.ok) return reply.code(502).send({ error: "goout", status: res.status });
			const { cookies } = mergeSetCookies({}, res);
			if (!Object.keys(cookies).length) return reply.code(502).send({ error: "goout" });
			return { session: encodeSession(cookies) };
		},
	);

	app.post(`${api}/logout`, async (req, reply) => {
		const cookies = decodeSession(req.headers[SESSION_HEADER]);
		if (cookies) await call("/services/user/auth/v1/logout", cookies, { method: "POST" }).catch(() => undefined);
		return reply.code(204).send();
	});

	app.get(`${api}/tickets`, async (req, reply) => {
		const cookies = session(req, reply);
		if (!cookies) return;
		const res = await call("/services/saleform/purchase/v2/list?current=true", cookies);
		refresh(reply, cookies, res);
		if (res.status === 401 || res.status === 403) return reply.code(401).send({ error: "login" });
		if (!res.ok) return reply.code(502).send({ error: "goout", status: res.status });
		return { tickets: toTickets((await res.json()) as PurchaseList, goout.origin) };
	});

	app.get<{ Querystring: { url?: string } }>(`${api}/ticket`, async (req, reply) => {
		const cookies = session(req, reply);
		if (!cookies) return;
		let target: URL;
		try {
			target = new URL(req.query.url ?? "");
		} catch {
			return reply.code(400).send({ error: "url" });
		}
		if (target.origin !== goout.origin) return reply.code(400).send({ error: "url" });
		let res = await call(target.pathname + target.search, cookies);
		for (let i = 0; i < 5 && res.status >= 300 && res.status < 400 && res.headers.get("location"); i++) {
			const next = new URL(res.headers.get("location")!, target);
			if (next.origin !== goout.origin) return reply.code(502).send({ error: "redirect" });
			res = await call(next.pathname + next.search, cookies);
		}
		refresh(reply, cookies, res);
		if (res.status === 401 || res.status === 403) return reply.code(401).send({ error: "login" });
		if (!res.ok) return reply.code(502).send({ error: "goout", status: res.status });
		const type = res.headers.get("content-type") ?? "application/octet-stream";
		if (type.includes("text/html")) {
			const codes = parseMobileTicket(await res.text());
			if (codes.length) return { codes };
			return reply.code(202).send({ error: "emailed" });
		}
		reply.header("cache-control", "no-store");
		return reply.type(type).send(Buffer.from(await res.arrayBuffer()));
	});

	const serveWeb = !!webRoot && existsSync(webRoot);
	app.setNotFoundHandler((req, reply) => {
		const path = req.url.split("?")[0];
		if (!serveWeb || req.method !== "GET" || path.startsWith(`${api}/`) || !path.startsWith(`${base}/`)) {
			return reply.code(404).send({ error: "Not found." });
		}
		return reply.type("text/html").sendFile("index.html");
	});

	if (serveWeb) {
		if (base) app.get(base, (_, reply) => reply.redirect(`${base}/`));
		await app.register(fastifyStatic, { root: webRoot, prefix: `${base}/`, wildcard: false });
	}

	return app;
}
