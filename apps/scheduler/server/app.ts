import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import Fastify, { type FastifyInstance, type FastifyReply } from "fastify";
import fastifyStatic from "@fastify/static";
import type pg from "pg";

export const LIMITS = {
	slots: 100,
	responses: 300,
	title: 200,
	text: 2000,
	name: 80,
};

export interface AppOptions {
	pool: pg.Pool;
	/** URL prefix the app lives under, e.g. "/scheduler". Empty for the root. */
	basePath?: string;
	/** Directory with the built Angular app; served with SPA fallback when set. */
	webRoot?: string;
	logger?: boolean;
}

type Vote = "yes" | "maybe" | "no";

interface SlotInput {
	id?: number;
	start: string;
	end: string;
}

const newKey = (bytes: number) => randomBytes(bytes).toString("base64url");
const hash = (key: string) => createHash("sha256").update(key).digest("hex");
const keyMatches = (key: unknown, storedHash: string) =>
	typeof key === "string" &&
	key.length > 0 &&
	timingSafeEqual(Buffer.from(hash(key), "hex"), Buffer.from(storedHash, "hex"));

const slotSchema = {
	type: "object",
	required: ["start", "end"],
	additionalProperties: false,
	properties: {
		id: { type: "integer" },
		start: { type: "string", format: "date-time" },
		end: { type: "string", format: "date-time" },
	},
};

const votesSchema = {
	type: "object",
	maxProperties: LIMITS.slots,
	additionalProperties: { type: "string", enum: ["yes", "maybe", "no"] },
};

const responseBody = {
	type: "object",
	required: ["name", "votes"],
	additionalProperties: false,
	properties: {
		name: { type: "string", minLength: 1, maxLength: LIMITS.name },
		votes: votesSchema,
	},
};

function validTimezone(tz: string) {
	try {
		new Intl.DateTimeFormat("en", { timeZone: tz });
		return true;
	} catch {
		return false;
	}
}

function checkSlots(slots: SlotInput[]): string | null {
	for (const s of slots) {
		if (new Date(s.end) <= new Date(s.start)) return "Each slot must end after it starts.";
	}
	return null;
}

const notFound = (reply: FastifyReply) => reply.code(404).send({ error: "Poll not found." });

export async function buildApp({ pool, webRoot, basePath = "", logger = false }: AppOptions): Promise<FastifyInstance> {
	// Requests are not logged with IPs; we only want errors.
	const app = Fastify({ logger: logger ? { level: "warn" } : false, bodyLimit: 64 * 1024 });
	const base = basePath.replace(/\/+$/, "");
	const api = `${base}/api`;

	const schemaSql = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
	await pool.query(schemaSql);

	async function loadPoll(id: string) {
		const poll = await pool.query("SELECT * FROM polls WHERE id = $1", [id]);
		return poll.rows[0] as
			| {
					id: string;
					admin_key_hash: string;
					title: string;
					description: string;
					location: string;
					timezone: string;
					closed: boolean;
					final_slot_id: string | null;
					created_at: Date;
			  }
			| undefined;
	}

	async function pollView(id: string) {
		const poll = await loadPoll(id);
		if (!poll) return null;
		const [slots, responses, votes] = await Promise.all([
			pool.query("SELECT id, starts_at, ends_at FROM slots WHERE poll_id = $1 ORDER BY starts_at, ends_at, id", [
				id,
			]),
			pool.query("SELECT id, name, created_at FROM responses WHERE poll_id = $1 ORDER BY created_at, id", [id]),
			pool.query(
				"SELECT v.response_id, v.slot_id, v.value FROM votes v JOIN responses r ON r.id = v.response_id WHERE r.poll_id = $1",
				[id],
			),
		]);
		const byResponse = new Map<string, Record<string, Vote>>();
		for (const v of votes.rows) {
			const m = byResponse.get(v.response_id) ?? {};
			m[v.slot_id] = v.value;
			byResponse.set(v.response_id, m);
		}
		return {
			id: poll.id,
			title: poll.title,
			description: poll.description,
			location: poll.location,
			timezone: poll.timezone,
			closed: poll.closed,
			finalSlotId: poll.final_slot_id === null ? null : Number(poll.final_slot_id),
			createdAt: poll.created_at,
			slots: slots.rows.map((s) => ({ id: Number(s.id), start: s.starts_at, end: s.ends_at })),
			responses: responses.rows.map((r) => ({
				id: Number(r.id),
				name: r.name,
				votes: byResponse.get(r.id) ?? {},
			})),
		};
	}

	async function writeVotes(client: pg.PoolClient, pollId: string, responseId: number, votes: Record<string, Vote>) {
		await client.query("DELETE FROM votes WHERE response_id = $1", [responseId]);
		const valid = Object.fromEntries(Object.entries(votes).filter(([slotId]) => /^\d{1,15}$/.test(slotId)));
		if (Object.keys(valid).length === 0) return;
		// Only slots of this poll; votes for unknown slots are ignored.
		await client.query(
			`INSERT INTO votes (response_id, slot_id, value)
       SELECT $1, s.id, v.value
       FROM jsonb_each_text($3::jsonb) AS v(slot_id, value)
       JOIN slots s ON s.id = v.slot_id::bigint AND s.poll_id = $2`,
			[responseId, pollId, JSON.stringify(valid)],
		);
	}

	async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const result = await fn(client);
			await client.query("COMMIT");
			return result;
		} catch (e) {
			await client.query("ROLLBACK");
			throw e;
		} finally {
			client.release();
		}
	}

	app.get(`${api}/health`, async () => {
		await pool.query("SELECT 1");
		return { ok: true };
	});

	app.post<{
		Body: { title: string; description?: string; location?: string; timezone: string; slots: SlotInput[] };
	}>(
		`${api}/polls`,
		{
			schema: {
				body: {
					type: "object",
					required: ["title", "timezone", "slots"],
					additionalProperties: false,
					properties: {
						title: { type: "string", minLength: 1, maxLength: LIMITS.title },
						description: { type: "string", maxLength: LIMITS.text },
						location: { type: "string", maxLength: LIMITS.title },
						timezone: { type: "string", maxLength: 64 },
						slots: { type: "array", minItems: 1, maxItems: LIMITS.slots, items: slotSchema },
					},
				},
			},
		},
		async (req, reply) => {
			const b = req.body;
			if (!validTimezone(b.timezone)) return reply.code(400).send({ error: "Unknown timezone." });
			const slotError = checkSlots(b.slots);
			if (slotError) return reply.code(400).send({ error: slotError });

			const id = newKey(9);
			const adminKey = newKey(18);
			await tx(async (c) => {
				await c.query(
					"INSERT INTO polls (id, admin_key_hash, title, description, location, timezone) VALUES ($1, $2, $3, $4, $5, $6)",
					[
						id,
						hash(adminKey),
						b.title.trim(),
						b.description?.trim() ?? "",
						b.location?.trim() ?? "",
						b.timezone,
					],
				);
				await c.query(
					`INSERT INTO slots (poll_id, starts_at, ends_at)
           SELECT $1, x.s, x.e FROM unnest($2::timestamptz[], $3::timestamptz[]) AS x(s, e)`,
					[id, b.slots.map((s) => s.start), b.slots.map((s) => s.end)],
				);
			});
			return reply.code(201).send({ id, adminKey });
		},
	);

	app.get<{ Params: { id: string } }>(`${api}/polls/:id`, async (req, reply) => {
		const view = await pollView(req.params.id);
		return view ?? notFound(reply);
	});

	// Lets the creator check that a stored admin key is still valid.
	app.get<{ Params: { id: string } }>(`${api}/polls/:id/admin`, async (req, reply) => {
		const poll = await loadPoll(req.params.id);
		if (!poll) return notFound(reply);
		if (!keyMatches(req.headers["x-admin-key"], poll.admin_key_hash))
			return reply.code(403).send({ error: "Invalid admin key." });
		return { ok: true };
	});

	app.patch<{
		Params: { id: string };
		Body: {
			title?: string;
			description?: string;
			location?: string;
			closed?: boolean;
			finalSlotId?: number | null;
			slots?: SlotInput[];
		};
	}>(
		`${api}/polls/:id`,
		{
			schema: {
				body: {
					type: "object",
					additionalProperties: false,
					properties: {
						title: { type: "string", minLength: 1, maxLength: LIMITS.title },
						description: { type: "string", maxLength: LIMITS.text },
						location: { type: "string", maxLength: LIMITS.title },
						closed: { type: "boolean" },
						finalSlotId: { type: ["integer", "null"] },
						slots: { type: "array", minItems: 1, maxItems: LIMITS.slots, items: slotSchema },
					},
				},
			},
		},
		async (req, reply) => {
			const poll = await loadPoll(req.params.id);
			if (!poll) return notFound(reply);
			if (!keyMatches(req.headers["x-admin-key"], poll.admin_key_hash))
				return reply.code(403).send({ error: "Invalid admin key." });
			const b = req.body;
			if (b.slots) {
				const slotError = checkSlots(b.slots);
				if (slotError) return reply.code(400).send({ error: slotError });
			}

			const result = await tx(async (c) => {
				if (b.slots) {
					// Slots with an id are kept (and may be moved); the rest of the old ones are removed.
					const keep = b.slots.filter((s) => s.id !== undefined);
					const existing = await c.query("SELECT id FROM slots WHERE poll_id = $1", [poll.id]);
					const existingIds = new Set(existing.rows.map((r) => Number(r.id)));
					if (keep.some((s) => !existingIds.has(s.id!))) return "Unknown slot id.";
					await c.query("DELETE FROM slots WHERE poll_id = $1 AND NOT (id = ANY($2::bigint[]))", [
						poll.id,
						keep.map((s) => s.id),
					]);
					for (const s of keep) {
						await c.query("UPDATE slots SET starts_at = $2, ends_at = $3 WHERE id = $1", [
							s.id,
							s.start,
							s.end,
						]);
					}
					const added = b.slots.filter((s) => s.id === undefined);
					await c.query(
						`INSERT INTO slots (poll_id, starts_at, ends_at)
             SELECT $1, x.s, x.e FROM unnest($2::timestamptz[], $3::timestamptz[]) AS x(s, e)`,
						[poll.id, added.map((s) => s.start), added.map((s) => s.end)],
					);
				}
				let finalSlotId = b.finalSlotId === undefined ? poll.final_slot_id : b.finalSlotId;
				if (finalSlotId !== null) {
					const ok = await c.query("SELECT 1 FROM slots WHERE id = $1 AND poll_id = $2", [
						finalSlotId,
						poll.id,
					]);
					if (ok.rowCount === 0) {
						if (b.finalSlotId !== undefined) return "Unknown slot id.";
						finalSlotId = null; // the chosen slot was just removed
					}
				}
				await c.query(
					`UPDATE polls SET title = $2, description = $3, location = $4, closed = $5, final_slot_id = $6, updated_at = now()
           WHERE id = $1`,
					[
						poll.id,
						b.title?.trim() ?? poll.title,
						b.description?.trim() ?? poll.description,
						b.location?.trim() ?? poll.location,
						b.closed ?? poll.closed,
						finalSlotId,
					],
				);
				return null;
			});
			if (result) return reply.code(400).send({ error: result });
			return pollView(poll.id);
		},
	);

	app.delete<{ Params: { id: string } }>(`${api}/polls/:id`, async (req, reply) => {
		const poll = await loadPoll(req.params.id);
		if (!poll) return notFound(reply);
		if (!keyMatches(req.headers["x-admin-key"], poll.admin_key_hash))
			return reply.code(403).send({ error: "Invalid admin key." });
		await pool.query("DELETE FROM polls WHERE id = $1", [poll.id]);
		return reply.code(204).send();
	});

	app.post<{ Params: { id: string }; Body: { name: string; votes: Record<string, Vote> } }>(
		`${api}/polls/:id/responses`,
		{ schema: { body: responseBody } },
		async (req, reply) => {
			const poll = await loadPoll(req.params.id);
			if (!poll) return notFound(reply);
			if (poll.closed) return reply.code(409).send({ error: "This poll is closed." });
			const name = req.body.name.trim();
			if (!name) return reply.code(400).send({ error: "Please enter your name." });
			const count = await pool.query("SELECT count(*)::int AS n FROM responses WHERE poll_id = $1", [poll.id]);
			if (count.rows[0].n >= LIMITS.responses)
				return reply.code(409).send({ error: "This poll has too many responses." });

			const editKey = newKey(18);
			const id = await tx(async (c) => {
				const r = await c.query(
					"INSERT INTO responses (poll_id, name, edit_key_hash) VALUES ($1, $2, $3) RETURNING id",
					[poll.id, name, hash(editKey)],
				);
				const rid = Number(r.rows[0].id);
				await writeVotes(c, poll.id, rid, req.body.votes);
				return rid;
			});
			return reply.code(201).send({ id, editKey });
		},
	);

	async function authorizeResponse(pollId: string, responseId: string, headers: Record<string, unknown>) {
		const poll = await loadPoll(pollId);
		if (!poll) return { error: 404 as const };
		const r = await pool.query("SELECT id, edit_key_hash FROM responses WHERE id = $1 AND poll_id = $2", [
			Number(responseId) || 0,
			pollId,
		]);
		const row = r.rows[0];
		if (!row) return { error: 404 as const };
		const isOwner = keyMatches(headers["x-edit-key"], row.edit_key_hash);
		const isAdmin = keyMatches(headers["x-admin-key"], poll.admin_key_hash);
		return { poll, responseId: Number(row.id), isOwner, isAdmin };
	}

	app.put<{ Params: { id: string; rid: string }; Body: { name: string; votes: Record<string, Vote> } }>(
		`${api}/polls/:id/responses/:rid`,
		{ schema: { body: responseBody } },
		async (req, reply) => {
			const auth = await authorizeResponse(req.params.id, req.params.rid, req.headers);
			if ("error" in auth) return reply.code(404).send({ error: "Response not found." });
			if (!auth.isOwner) return reply.code(403).send({ error: "You can only edit your own response." });
			if (auth.poll.closed) return reply.code(409).send({ error: "This poll is closed." });
			const name = req.body.name.trim();
			if (!name) return reply.code(400).send({ error: "Please enter your name." });
			await tx(async (c) => {
				await c.query("UPDATE responses SET name = $2, updated_at = now() WHERE id = $1", [
					auth.responseId,
					name,
				]);
				await writeVotes(c, auth.poll.id, auth.responseId, req.body.votes);
			});
			return { ok: true };
		},
	);

	app.delete<{ Params: { id: string; rid: string } }>(`${api}/polls/:id/responses/:rid`, async (req, reply) => {
		const auth = await authorizeResponse(req.params.id, req.params.rid, req.headers);
		if ("error" in auth) return reply.code(404).send({ error: "Response not found." });
		if (!auth.isOwner && !auth.isAdmin) return reply.code(403).send({ error: "Not allowed." });
		await pool.query("DELETE FROM responses WHERE id = $1", [auth.responseId]);
		return reply.code(204).send();
	});

	const serveWeb = !!webRoot && existsSync(webRoot);
	app.setNotFoundHandler((req, reply) => {
		const path = req.url.split("?")[0];
		if (!serveWeb || req.method !== "GET" || path.startsWith(`${api}/`) || !path.startsWith(`${base}/`)) {
			return reply.code(404).send({ error: "Not found." });
		}
		// Client-side routes all render the app shell.
		return reply.type("text/html").sendFile("index.html");
	});

	if (serveWeb) {
		if (base) app.get(base, (_, reply) => reply.redirect(`${base}/`));
		await app.register(fastifyStatic, { root: webRoot, prefix: `${base}/`, wildcard: false });
	}

	return app;
}

/** Deletes polls whose last slot ended more than `days` ago. Returns how many were removed. */
export async function purgeOldPolls(pool: pg.Pool, days: number) {
	const r = await pool.query(
		`DELETE FROM polls p
     WHERE p.created_at < now() - make_interval(days => $1)
       AND NOT EXISTS (SELECT 1 FROM slots s WHERE s.poll_id = p.id AND s.ends_at > now() - make_interval(days => $1))`,
		[days],
	);
	return r.rowCount ?? 0;
}
