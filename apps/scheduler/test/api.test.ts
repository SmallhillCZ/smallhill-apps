import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import pg from "pg";
import { buildApp, purgeOldPolls } from "../server/app.ts";

const pool = new pg.Pool({
	connectionString: process.env.TEST_DATABASE_URL ?? "postgres://scheduler:scheduler@localhost:5432/scheduler_test",
});
let app: Awaited<ReturnType<typeof buildApp>>;

before(async () => {
	await pool.query("DROP TABLE IF EXISTS votes, responses, slots, polls");
	app = await buildApp({ pool });
});
after(async () => {
	await app.close();
	await pool.end();
});

const slots = [
	{ start: "2030-03-02T09:00:00Z", end: "2030-03-02T10:00:00Z" },
	{ start: "2030-03-01T09:00:00Z", end: "2030-03-01T10:00:00Z" },
];

async function createPoll() {
	const res = await app.inject({
		method: "POST",
		url: "/api/polls",
		payload: { title: " Team lunch ", timezone: "Europe/Prague", slots },
	});
	assert.equal(res.statusCode, 201);
	return res.json() as { id: string; adminKey: string };
}

const getPoll = async (id: string) => (await app.inject({ url: `/api/polls/${id}` })).json();

test("creates a poll and returns it with sorted slots, without secrets", async () => {
	const { id } = await createPoll();
	const poll = await getPoll(id);
	assert.equal(poll.title, "Team lunch");
	assert.deepEqual(
		poll.slots.map((s: { start: string }) => s.start),
		["2030-03-01T09:00:00.000Z", "2030-03-02T09:00:00.000Z"],
	);
	assert.equal(JSON.stringify(poll).includes("hash"), false);
});

test("rejects invalid polls", async () => {
	const bad = [
		{ title: "", timezone: "Europe/Prague", slots },
		{ title: "x", timezone: "Mars/Base", slots },
		{ title: "x", timezone: "UTC", slots: [] },
		{ title: "x", timezone: "UTC", slots: [{ start: "2030-01-01T10:00:00Z", end: "2030-01-01T09:00:00Z" }] },
	];
	for (const payload of bad) {
		const res = await app.inject({ method: "POST", url: "/api/polls", payload });
		assert.equal(res.statusCode, 400, JSON.stringify(payload));
	}
});

test("participants respond, edit their own response only, and admin can remove it", async () => {
	const { id, adminKey } = await createPoll();
	const [a, b] = (await getPoll(id)).slots;

	const created = await app.inject({
		method: "POST",
		url: `/api/polls/${id}/responses`,
		payload: { name: "Eva", votes: { [a.id]: "yes", [b.id]: "maybe", "999999": "yes", abc: "no" } },
	});
	assert.equal(created.statusCode, 201);
	const { id: rid, editKey } = created.json();

	let poll = await getPoll(id);
	assert.deepEqual(poll.responses[0].votes, { [a.id]: "yes", [b.id]: "maybe" });

	const forbidden = await app.inject({
		method: "PUT",
		url: `/api/polls/${id}/responses/${rid}`,
		headers: { "x-edit-key": "wrong" },
		payload: { name: "Mallory", votes: {} },
	});
	assert.equal(forbidden.statusCode, 403);

	const edited = await app.inject({
		method: "PUT",
		url: `/api/polls/${id}/responses/${rid}`,
		headers: { "x-edit-key": editKey },
		payload: { name: "Eva K.", votes: { [a.id]: "no" } },
	});
	assert.equal(edited.statusCode, 200);
	poll = await getPoll(id);
	assert.equal(poll.responses[0].name, "Eva K.");
	assert.deepEqual(poll.responses[0].votes, { [a.id]: "no" });

	const removed = await app.inject({
		method: "DELETE",
		url: `/api/polls/${id}/responses/${rid}`,
		headers: { "x-admin-key": adminKey },
	});
	assert.equal(removed.statusCode, 204);
	assert.equal((await getPoll(id)).responses.length, 0);
});

test("admin edits slots, picks a final slot and closes the poll", async () => {
	const { id, adminKey } = await createPoll();
	const [a, b] = (await getPoll(id)).slots;
	const resp = await app.inject({
		method: "POST",
		url: `/api/polls/${id}/responses`,
		payload: { name: "Petr", votes: { [a.id]: "yes", [b.id]: "yes" } },
	});

	const noKey = await app.inject({ method: "PATCH", url: `/api/polls/${id}`, payload: { closed: true } });
	assert.equal(noKey.statusCode, 403);

	const patched = await app.inject({
		method: "PATCH",
		url: `/api/polls/${id}`,
		headers: { "x-admin-key": adminKey },
		payload: {
			slots: [
				{ id: a.id, start: a.start, end: a.end },
				{ start: "2030-03-05T12:00:00Z", end: "2030-03-05T13:00:00Z" },
			],
			finalSlotId: a.id,
			closed: true,
		},
	});
	assert.equal(patched.statusCode, 200);
	const poll = patched.json();
	assert.equal(poll.slots.length, 2);
	assert.equal(poll.closed, true);
	assert.equal(poll.finalSlotId, a.id);
	// The vote for the removed slot is gone, the kept one stays.
	assert.deepEqual(poll.responses[0].votes, { [a.id]: "yes" });

	const late = await app.inject({
		method: "POST",
		url: `/api/polls/${id}/responses`,
		payload: { name: "Late", votes: {} },
	});
	assert.equal(late.statusCode, 409);

	// Removing the final slot clears it.
	const moved = await app.inject({
		method: "PATCH",
		url: `/api/polls/${id}`,
		headers: { "x-admin-key": adminKey },
		payload: { slots: [{ start: "2030-04-01T12:00:00Z", end: "2030-04-01T13:00:00Z" }] },
	});
	assert.equal(moved.json().finalSlotId, null);
	assert.ok(resp.statusCode === 201);
});

test("admin deletes the poll", async () => {
	const { id, adminKey } = await createPoll();
	const res = await app.inject({ method: "DELETE", url: `/api/polls/${id}`, headers: { "x-admin-key": adminKey } });
	assert.equal(res.statusCode, 204);
	assert.equal((await app.inject({ url: `/api/polls/${id}` })).statusCode, 404);
});

test("purge removes only polls that are long over", async () => {
	const { id: fresh } = await createPoll();
	const { id: old } = await createPoll();
	await pool.query(`UPDATE polls SET created_at = now() - interval '200 days' WHERE id = $1`, [old]);
	await pool.query(
		`UPDATE slots SET starts_at = now() - interval '100 days', ends_at = now() - interval '99 days' WHERE poll_id = $1`,
		[old],
	);
	await purgeOldPolls(pool, 60);
	assert.equal((await app.inject({ url: `/api/polls/${old}` })).statusCode, 404);
	assert.equal((await app.inject({ url: `/api/polls/${fresh}` })).statusCode, 200);
});

test("serves the API and app under a base path", async () => {
	const prefixed = await buildApp({ pool, basePath: "/scheduler/" });
	assert.equal((await prefixed.inject({ url: "/scheduler/api/health" })).statusCode, 200);
	assert.equal((await prefixed.inject({ url: "/api/health" })).statusCode, 404);
	await prefixed.close();
});
