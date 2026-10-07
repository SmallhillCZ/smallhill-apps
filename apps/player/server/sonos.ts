import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";

export const SONOS_AUTH = "https://api.sonos.com/login/v3/oauth";
export const SONOS_API = "https://api.ws.sonos.com/control/api/v1";
export const APP_ID = "cz.smallhill.player";
export const CLOUD_QUEUE_VERSION = "v2.3";
export const LIMITS = { items: 2000, text: 200, url: 4096 };
const STATE_COOKIE = "player_sonos_state";
const ACTIONS = ["play", "pause", "seek", "skipToItem"] as const;

export interface SonosOptions {
	pool: pg.Pool;
	clientId?: string;
	clientSecret?: string;
	publicUrl?: string;
	fetch?: typeof fetch;
}

export interface QueueItem {
	id: string;
	title: string;
	artist?: string;
	album?: string;
	duration?: number | null;
	type?: string;
	url?: string | null;
}

interface Tokens {
	access: string;
	refresh: string;
	expires: number;
}

interface QueueRow {
	id: string;
	key_hash: string;
	group_id: string;
	session_id: string;
	items: QueueItem[];
	version: number;
}

class SonosError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const keyMatches = (key: unknown, storedHash: string) =>
	typeof key === "string" &&
	key.length > 0 &&
	timingSafeEqual(Buffer.from(hash(key), "hex"), Buffer.from(storedHash, "hex"));
const newKey = (bytes: number) => randomBytes(bytes).toString("base64url");
const enc = encodeURIComponent;

const itemSchema = {
	type: "object",
	required: ["id", "title"],
	additionalProperties: false,
	properties: {
		id: { type: "string", minLength: 1, maxLength: 128 },
		title: { type: "string", maxLength: LIMITS.text },
		artist: { type: "string", maxLength: LIMITS.text },
		album: { type: "string", maxLength: LIMITS.text },
		duration: { type: ["number", "null"], minimum: 0 },
		type: { type: "string", maxLength: 100 },
		url: { type: ["string", "null"], maxLength: LIMITS.url, pattern: "^https://" },
	},
};
const itemsSchema = { type: "array", maxItems: LIMITS.items, items: itemSchema };

function cookie(req: FastifyRequest, name: string): string | null {
	for (const part of (req.headers.cookie ?? "").split(";")) {
		const [key, ...value] = part.trim().split("=");
		if (key === name) return value.join("=");
	}
	return null;
}

const withoutUrls = (items: QueueItem[]) =>
	JSON.stringify(items.map((i) => [i.id, i.title, i.artist ?? "", i.album ?? "", i.duration ?? null, i.type ?? ""]));

export async function registerSonos(app: FastifyInstance, base: string, options: SonosOptions): Promise<void> {
	const { pool, clientId, clientSecret } = options;
	const http = options.fetch ?? fetch;
	const enabled = !!clientId && !!clientSecret;
	const api = `${base}/api/sonos`;
	const sealKey = createHash("sha256")
		.update(`player-sonos:${clientSecret ?? ""}`)
		.digest();
	const schemaSql = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
	let schemaReady: Promise<unknown> | null = null;

	const db = async () => {
		schemaReady ??= pool.query(schemaSql).catch((error) => {
			schemaReady = null;
			throw error;
		});
		await schemaReady;
		return pool;
	};

	const origin = (req: FastifyRequest) => {
		if (options.publicUrl) return options.publicUrl.replace(/\/+$/, "");
		const proto =
			String(req.headers["x-forwarded-proto"] ?? "")
				.split(",")[0]
				.trim() || req.protocol;
		return `${proto}://${req.headers.host}`;
	};
	const callbackUrl = (req: FastifyRequest) => `${origin(req)}${api}/callback`;
	const queueBase = (req: FastifyRequest, id: string) => `${origin(req)}${api}/cq/${id}/${CLOUD_QUEUE_VERSION}/`;

	function seal(tokens: Tokens): string {
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", sealKey, iv);
		const data = Buffer.concat([cipher.update(JSON.stringify(tokens), "utf8"), cipher.final()]);
		return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
	}

	function unseal(blob: unknown): Tokens | null {
		if (typeof blob !== "string" || !blob) return null;
		try {
			const raw = Buffer.from(blob, "base64url");
			const decipher = createDecipheriv("aes-256-gcm", sealKey, raw.subarray(0, 12));
			decipher.setAuthTag(raw.subarray(12, 28));
			const json = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
			const tokens = JSON.parse(json) as Tokens;
			return tokens.access && tokens.refresh ? tokens : null;
		} catch {
			return null;
		}
	}

	async function tokenRequest(params: Record<string, string>): Promise<Tokens> {
		const response = await http(`${SONOS_AUTH}/access`, {
			method: "POST",
			headers: {
				Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
				"Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
			},
			body: new URLSearchParams(params).toString(),
		});
		if (!response.ok) throw new SonosError(401, `Sonos token request failed (${response.status}).`);
		const body = (await response.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
		if (!body.access_token || !body.refresh_token) throw new SonosError(401, "Sonos returned no token.");
		return {
			access: body.access_token,
			refresh: body.refresh_token,
			expires: Date.now() + (body.expires_in ?? 86400) * 1000,
		};
	}

	async function accessToken(req: FastifyRequest, reply: FastifyReply): Promise<string> {
		const tokens = unseal(req.headers["x-sonos-token"]);
		if (!tokens) throw new SonosError(401, "Not connected to Sonos.");
		if (tokens.expires - 5 * 60 * 1000 > Date.now()) return tokens.access;
		const fresh = await tokenRequest({ grant_type: "refresh_token", refresh_token: tokens.refresh });
		reply.header("X-Sonos-Token", seal(fresh));
		return fresh.access;
	}

	async function call<T = Record<string, unknown>>(
		access: string,
		method: "GET" | "POST",
		path: string,
		body?: unknown,
	): Promise<T> {
		const response = await http(`${SONOS_API}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${access}`,
				...(body === undefined ? {} : { "Content-Type": "application/json" }),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		const text = await response.text();
		if (!response.ok)
			throw new SonosError(response.status, `Sonos ${method} ${path} failed: ${text.slice(0, 300)}`);
		return (text ? JSON.parse(text) : {}) as T;
	}

	async function handle(req: FastifyRequest, reply: FastifyReply, run: () => Promise<unknown>) {
		if (!enabled) return reply.code(404).send({ error: "Sonos is not set up." });
		try {
			return await run();
		} catch (error) {
			if (!(error instanceof SonosError)) throw error;
			req.log.warn(error.message);
			if (error.status === 401 || error.status === 403)
				return reply.code(401).send({ error: "reconnect", message: error.message });
			if (error.status === 404 || error.status === 410)
				return reply.code(410).send({ error: "gone", message: error.message });
			return reply.code(502).send({ error: "sonos", message: error.message });
		}
	}

	async function loadQueue(req: FastifyRequest<{ Params: { id: string } }>, key: unknown): Promise<QueueRow | null> {
		const result = await (
			await db()
		).query<QueueRow>("SELECT * FROM player_sonos_queues WHERE id = $1", [req.params.id]);
		const row = result.rows[0];
		return row && keyMatches(key, row.key_hash) ? row : null;
	}

	const bearer = (req: FastifyRequest) => String(req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");

	function track(req: FastifyRequest, queueId: string, item: QueueItem) {
		return {
			type: "track",
			name: item.title,
			mediaUrl: `${origin(req)}${api}/cq/${queueId}/media/${enc(item.id)}`,
			contentType: item.type ?? "audio/mpeg",
			imageUrl: `${origin(req)}${base}/icons/icon-512x512.png`,
			...(item.duration ? { durationMillis: Math.round(item.duration * 1000) } : {}),
			...(item.artist ? { artist: { name: item.artist } } : {}),
			...(item.album ? { album: { name: item.album } } : {}),
		};
	}

	app.get(`${api}/config`, async () => ({ enabled }));

	app.get(`${api}/login`, async (req, reply) => {
		if (!enabled) return reply.code(404).send({ error: "Sonos is not set up." });
		const state = newKey(18);
		reply.header(
			"Set-Cookie",
			`${STATE_COOKIE}=${state}; Path=${api}/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
		);
		const url = new URL(SONOS_AUTH);
		url.search = new URLSearchParams({
			client_id: clientId!,
			response_type: "code",
			state,
			scope: "playback-control-all",
			redirect_uri: callbackUrl(req),
		}).toString();
		return reply.redirect(url.href);
	});

	app.get<{ Querystring: { code?: string; state?: string } }>(`${api}/callback`, async (req, reply) => {
		const expected = cookie(req, STATE_COOKIE);
		reply.header("Set-Cookie", `${STATE_COOKIE}=; Path=${api}/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
		const fail = () => reply.redirect(`${base}/#sonos-error`);
		if (!enabled || !req.query.code || !expected || req.query.state !== expected) return fail();
		try {
			const tokens = await tokenRequest({
				grant_type: "authorization_code",
				code: req.query.code,
				redirect_uri: callbackUrl(req),
			});
			return reply.redirect(`${base}/#sonos=${seal(tokens)}`);
		} catch (error) {
			req.log.warn(error);
			return fail();
		}
	});

	app.get(`${api}/groups`, (req, reply) =>
		handle(req, reply, async () => {
			const access = await accessToken(req, reply);
			const { households = [] } = await call<{ households?: { id: string; name?: string }[] }>(
				access,
				"GET",
				"/households",
			);
			const groups = [];
			for (const household of households) {
				const result = await call<{ groups?: { id: string; name: string; playbackState?: string }[] }>(
					access,
					"GET",
					`/households/${enc(household.id)}/groups`,
				);
				for (const group of result.groups ?? [])
					groups.push({ id: group.id, name: group.name, playbackState: group.playbackState ?? null });
			}
			return { groups };
		}),
	);

	app.post<{
		Body: { groupId: string; items: QueueItem[]; itemId: string; positionMillis?: number; play?: boolean };
	}>(
		`${api}/queues`,
		{
			bodyLimit: 4 * 1024 * 1024,
			schema: {
				body: {
					type: "object",
					required: ["groupId", "items", "itemId"],
					additionalProperties: false,
					properties: {
						groupId: { type: "string", minLength: 1, maxLength: 64 },
						items: { ...itemsSchema, minItems: 1 },
						itemId: { type: "string", minLength: 1, maxLength: 128 },
						positionMillis: { type: "integer", minimum: 0 },
						play: { type: "boolean" },
					},
				},
			},
		},
		(req, reply) =>
			handle(req, reply, async () => {
				const { groupId, items, itemId, positionMillis = 0, play = true } = req.body;
				const item = items.find((i) => i.id === itemId);
				if (!item) return reply.code(400).send({ error: "Unknown item." });
				const access = await accessToken(req, reply);
				const id = newKey(16);
				const key = newKey(24);
				const pg = await db();
				await pg.query(
					"INSERT INTO player_sonos_queues (id, key_hash, group_id, items) VALUES ($1, $2, $3, $4)",
					[id, hash(key), groupId, JSON.stringify(items)],
				);
				const session = await call<{ sessionId?: string }>(
					access,
					"POST",
					`/groups/${enc(groupId)}/playbackSession`,
					{ appId: APP_ID, appContext: id },
				);
				if (!session.sessionId) throw new SonosError(502, "Sonos returned no session.");
				await pg.query("UPDATE player_sonos_queues SET session_id = $2 WHERE id = $1", [id, session.sessionId]);
				await call(
					access,
					"POST",
					`/playbackSessions/${enc(session.sessionId)}/playbackSession/loadCloudQueue`,
					{
						queueBaseUrl: queueBase(req, id),
						httpAuthorization: `Bearer ${key}`,
						itemId,
						queueVersion: "1",
						positionMillis,
						playOnCompletion: play,
						trackMetadata: track(req, id, item),
					},
				);
				return reply.code(201).send({ id, key, version: 1 });
			}),
	);

	app.put<{ Params: { id: string }; Body: { items: QueueItem[] } }>(
		`${api}/queues/:id`,
		{
			bodyLimit: 4 * 1024 * 1024,
			schema: {
				body: {
					type: "object",
					required: ["items"],
					additionalProperties: false,
					properties: { items: itemsSchema },
				},
			},
		},
		(req, reply) =>
			handle(req, reply, async () => {
				const row = await loadQueue(req, req.headers["x-queue-key"]);
				if (!row) return reply.code(404).send({ error: "Queue not found." });
				const changed = withoutUrls(row.items) !== withoutUrls(req.body.items);
				const version = changed ? row.version + 1 : row.version;
				await (
					await db()
				).query("UPDATE player_sonos_queues SET items = $2, version = $3, updated_at = now() WHERE id = $1", [
					row.id,
					JSON.stringify(req.body.items),
					version,
				]);
				if (changed && row.session_id && req.headers["x-sonos-token"]) {
					const access = await accessToken(req, reply);
					await call(
						access,
						"POST",
						`/playbackSessions/${enc(row.session_id)}/playbackSession/refreshCloudQueue`,
					);
				}
				return { version };
			}),
	);

	app.delete<{ Params: { id: string } }>(`${api}/queues/:id`, async (req, reply) => {
		const row = enabled ? await loadQueue(req, req.headers["x-queue-key"]) : null;
		if (!row) return reply.code(404).send({ error: "Queue not found." });
		await (await db()).query("DELETE FROM player_sonos_queues WHERE id = $1", [row.id]);
		return reply.code(204).send();
	});

	app.post<{
		Params: { id: string };
		Body: { action: (typeof ACTIONS)[number]; itemId?: string; positionMillis?: number; play?: boolean };
	}>(
		`${api}/queues/:id/control`,
		{
			schema: {
				body: {
					type: "object",
					required: ["action"],
					additionalProperties: false,
					properties: {
						action: { type: "string", enum: ACTIONS },
						itemId: { type: "string", minLength: 1, maxLength: 128 },
						positionMillis: { type: "integer", minimum: 0 },
						play: { type: "boolean" },
					},
				},
			},
		},
		(req, reply) =>
			handle(req, reply, async () => {
				const row = await loadQueue(req, req.headers["x-queue-key"]);
				if (!row) return reply.code(404).send({ error: "Queue not found." });
				const access = await accessToken(req, reply);
				const group = `/groups/${enc(row.group_id)}/playback`;
				const { action, itemId, positionMillis = 0, play = true } = req.body;
				if (action === "play" || action === "pause") await call(access, "POST", `${group}/${action}`);
				else if (action === "seek")
					await call(access, "POST", `${group}/seek`, { positionMillis, ...(itemId ? { itemId } : {}) });
				else {
					if (!itemId) return reply.code(400).send({ error: "itemId is required." });
					await call(access, "POST", `/playbackSessions/${enc(row.session_id)}/playbackSession/skipToItem`, {
						itemId,
						queueVersion: String(row.version),
						positionMillis,
						playOnCompletion: play,
					});
				}
				return { ok: true };
			}),
	);

	app.get<{ Params: { id: string } }>(`${api}/queues/:id/status`, (req, reply) =>
		handle(req, reply, async () => {
			const row = await loadQueue(req, req.headers["x-queue-key"]);
			if (!row) return reply.code(404).send({ error: "Queue not found." });
			const access = await accessToken(req, reply);
			const status = await call<{
				playbackState?: string;
				itemId?: string | null;
				positionMillis?: number | null;
			}>(access, "GET", `/groups/${enc(row.group_id)}/playback`);
			return {
				state: status.playbackState ?? "PLAYBACK_STATE_IDLE",
				itemId: status.itemId ?? null,
				positionMillis: status.positionMillis ?? 0,
			};
		}),
	);

	async function cloudQueue(req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
		const row = enabled ? await loadQueue(req, bearer(req)) : null;
		if (!row) {
			reply.code(401).send({ error: "Unauthorized." });
			return null;
		}
		return row;
	}

	const cq = `${api}/cq/:id/:version`;

	app.get<{ Params: { id: string } }>(`${cq}/context`, async (req, reply) => {
		const row = await cloudQueue(req, reply);
		if (!row) return reply;
		return {
			contextVersion: "1",
			queueVersion: String(row.version),
			container: { type: "playlist", name: "Player", service: { name: "Smallhill Player" } },
			playbackPolicies: {
				canSkip: true,
				canSkipBack: true,
				canSkipToItem: true,
				canSeek: true,
				canRepeat: false,
				canRepeatOne: false,
				canShuffle: false,
				canCrossfade: true,
			},
		};
	});

	app.get<{ Params: { id: string } }>(`${cq}/version`, async (req, reply) => {
		const row = await cloudQueue(req, reply);
		if (!row) return reply;
		return { contextVersion: "1", queueVersion: String(row.version) };
	});

	app.get<{
		Params: { id: string };
		Querystring: { itemId?: string; previousWindowSize?: string; upcomingWindowSize?: string };
	}>(`${cq}/itemWindow`, async (req, reply) => {
		const row = await cloudQueue(req, reply);
		if (!row) return reply;
		const window = (value: string | undefined, fallback: number) => {
			const parsed = Number.parseInt(value ?? "", 10);
			return Math.max(0, Math.min(50, Number.isNaN(parsed) ? fallback : parsed));
		};
		const found = row.items.findIndex((item) => item.id === req.query.itemId);
		const index = Math.max(0, found);
		const start = Math.max(0, index - window(req.query.previousWindowSize, 0));
		const end = Math.min(row.items.length, index + window(req.query.upcomingWindowSize, 10) + 1);
		return {
			includesBeginningOfQueue: start === 0,
			includesEndOfQueue: end === row.items.length,
			contextVersion: "1",
			queueVersion: String(row.version),
			items: row.items.slice(start, end).map((item) => ({ id: item.id, track: track(req, row.id, item) })),
		};
	});

	app.post<{ Params: { id: string } }>(`${cq}/timePlayed`, async (req, reply) => {
		const row = await cloudQueue(req, reply);
		if (!row) return reply;
		return {};
	});

	app.get<{ Params: { id: string; itemId: string } }>(`${api}/cq/:id/media/:itemId`, async (req, reply) => {
		const result = enabled
			? await (
					await db()
				).query<{ items: QueueItem[] }>("SELECT items FROM player_sonos_queues WHERE id = $1", [req.params.id])
			: null;
		const url = result?.rows[0]?.items.find((item) => item.id === req.params.itemId)?.url;
		if (!url) return reply.code(404).send({ error: "Not found." });
		return reply.header("Cache-Control", "no-store").redirect(url, 302);
	});
}

export async function purgeOldQueues(pool: pg.Pool, days: number): Promise<number> {
	const r = await pool.query("DELETE FROM player_sonos_queues WHERE updated_at < now() - make_interval(days => $1)", [
		days,
	]);
	return r.rowCount ?? 0;
}
