import { existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";

export interface AppOptions {
	basePath?: string;
	webRoot?: string;
	logger?: boolean;
	googleUrl?: string;
	fetch?: typeof fetch;
}

export interface Place {
	name: string;
	address: string | null;
	note: string | null;
	lat: number;
	lng: number;
	placeId: string | null;
	cid: string | null;
}

export interface PlaceList {
	id: string;
	token: string | null;
	title: string;
	description: string | null;
	owner: { name: string; id: string | null } | null;
	places: Place[];
}

export class ListError extends Error {
	readonly kind: "url" | "notfound" | "google";
	readonly status?: number;
	constructor(kind: "url" | "notfound" | "google", status?: number) {
		super(kind);
		this.kind = kind;
		this.status = status;
	}
}

const SHORT_LINK_USER_AGENT = "Mozilla/5.0";
const USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
const CACHE_MS = 5 * 60 * 1000;

const isGoogleHost = (host: string) => /^(www\.)?google\.[a-z.]{2,6}$/.test(host);

export function isShareUrl(value: string): URL | null {
	let url: URL;
	try {
		url = new URL(value.trim());
	} catch {
		return null;
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") return null;
	url.protocol = "https:";
	if (url.hostname === "maps.app.goo.gl") return url;
	if (url.hostname === "goo.gl" && url.pathname.startsWith("/maps/")) return url;
	if (isGoogleHost(url.hostname) && url.pathname.startsWith("/maps")) return url;
	if (url.hostname === "maps.google.com") return url;
	return null;
}

export function parseListUrl(value: string): { id: string; token: string | null } | null {
	let text = value;
	for (let i = 0; i < 3; i++) {
		try {
			const url = new URL(text);
			const next = url.searchParams.get("continue");
			if (!next) break;
			text = next;
		} catch {
			break;
		}
	}
	let decoded = text;
	try {
		decoded = decodeURIComponent(text);
	} catch {}
	const id = /\/placelists\/list\/(-?[\w-]+)/.exec(decoded)?.[1] ?? /!11m\d+!2s(-?[\w-]+)/.exec(decoded)?.[1] ?? null;
	if (!id) return null;
	const token = /[?&!]token=([\w-]+)/.exec(decoded)?.[1] ?? /!3e\d+!4s([\w-]+)/.exec(decoded)?.[1] ?? null;
	return { id, token };
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const at = (v: unknown, ...path: number[]): unknown => {
	let cur = v;
	for (const i of path) {
		if (!Array.isArray(cur)) return undefined;
		cur = cur[i];
	}
	return cur;
};

export function toCid(value: unknown): string | null {
	if (typeof value !== "string" && typeof value !== "number") return null;
	try {
		return BigInt.asUintN(64, BigInt(value)).toString();
	} catch {
		return null;
	}
}

export function toPlaceList(raw: string, id: string, token: string | null): PlaceList {
	const json = raw.startsWith(")]}'") ? raw.slice(raw.indexOf("\n") > 0 ? raw.indexOf("\n") : 4) : raw;
	let data: unknown;
	try {
		data = JSON.parse(json);
	} catch {
		throw new ListError("google");
	}
	const list = at(data, 0);
	if (!Array.isArray(list)) throw new ListError("notfound");
	const entries = at(list, 8);
	const places: Place[] = [];
	for (const entry of Array.isArray(entries) ? entries : []) {
		const info = at(entry, 1);
		const lat = at(info, 5, 2);
		const lng = at(info, 5, 3);
		if (typeof lat !== "number" || typeof lng !== "number") continue;
		places.push({
			name: str(at(entry, 2)) ?? str(at(info, 2)) ?? "",
			address: str(at(info, 4)),
			note: str(at(entry, 3)),
			lat,
			lng,
			placeId: str(at(info, 7)),
			cid: toCid(at(info, 6, 1)),
		});
	}
	return {
		id,
		token,
		title: str(at(list, 4)) ?? "",
		description: str(at(list, 5)),
		owner: str(at(list, 3, 0)) ? { name: str(at(list, 3, 0))!, id: str(at(list, 3, 2)) } : null,
		places,
	};
}

export async function buildApp({
	basePath = "",
	webRoot,
	logger = false,
	googleUrl = "https://www.google.com",
	fetch: doFetch = fetch,
}: AppOptions = {}): Promise<FastifyInstance> {
	const app = Fastify({ logger: logger ? { level: "warn" } : false, bodyLimit: 16 * 1024 });
	const base = basePath.replace(/\/+$/, "");
	const api = `${base}/api`;
	const cache = new Map<string, { at: number; list: PlaceList }>();

	async function resolve(share: URL): Promise<{ id: string; token: string | null }> {
		const direct = parseListUrl(share.toString());
		if (direct) return direct;
		let url = share;
		for (let i = 0; i < 6; i++) {
			const res = await doFetch(url, { redirect: "manual", headers: { "User-Agent": SHORT_LINK_USER_AGENT } });
			const location = res.headers.get("location");
			if (res.status < 300 || res.status >= 400 || !location) break;
			url = new URL(location, url);
			const parsed = parseListUrl(url.toString());
			if (parsed) return parsed;
			if (!isShareUrl(url.toString()) && url.hostname !== "consent.google.com") break;
		}
		throw new ListError("notfound");
	}

	async function load(id: string, token: string | null, lang: string): Promise<PlaceList> {
		const key = `${id}|${token ?? ""}|${lang}`;
		const hit = cache.get(key);
		if (hit && Date.now() - hit.at < CACHE_MS) return hit.list;
		const page = `https://www.google.com/maps/placelists/list/${id}${token ? `?token=${token}` : ""}`;
		const pb =
			"!2e2!3e2!4i500!6m3" +
			`!1s${randomBytes(12).toString("base64url")}` +
			"!15i204459!28e2" +
			`!13s${encodeURIComponent(page)}` +
			"!16b1";
		const res = await doFetch(`${googleUrl}/maps/preview/entitylist/getlist?authuser=0&hl=${lang}&gl=cz&pb=${pb}`, {
			headers: { "User-Agent": USER_AGENT, Accept: "*/*" },
		});
		if (res.status === 404 || res.status === 403) throw new ListError("notfound", res.status);
		if (!res.ok) throw new ListError("google", res.status);
		const list = toPlaceList(await res.text(), id, token);
		if (cache.size > 500) cache.clear();
		cache.set(key, { at: Date.now(), list });
		return list;
	}

	app.get<{ Querystring: { url?: string; lang?: string } }>(`${api}/list`, async (req, reply) => {
		const share = isShareUrl(req.query.url ?? "");
		if (!share) return reply.code(400).send({ error: "url" });
		const lang = req.query.lang === "cs" ? "cs" : "en";
		try {
			const { id, token } = await resolve(share);
			return await load(id, token, lang);
		} catch (err) {
			if (err instanceof ListError) {
				return reply.code(err.kind === "google" ? 502 : 404).send({ error: err.kind });
			}
			req.log.warn(err);
			return reply.code(502).send({ error: "google" });
		}
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
