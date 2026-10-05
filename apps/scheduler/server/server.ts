import { resolve } from "node:path";
import pg from "pg";
import { buildApp, purgeOldPolls } from "./app.ts";

const env = process.env;
const pool = new pg.Pool({
	connectionString: env.DATABASE_URL ?? "postgres://scheduler:scheduler@localhost:5432/scheduler",
});
const retentionDays = Number(env.RETENTION_DAYS ?? 60);

const app = await buildApp({
	pool,
	webRoot: env.WEB_ROOT ? resolve(env.WEB_ROOT) : undefined,
	basePath: env.BASE_PATH ?? "",
	logger: true,
});

const purge = () => purgeOldPolls(pool, retentionDays).catch((e) => app.log.error(e));
await purge();
setInterval(purge, 6 * 60 * 60 * 1000).unref();

await app.listen({ host: env.HOST ?? "0.0.0.0", port: Number(env.PORT ?? 3000) });

for (const signal of ["SIGINT", "SIGTERM"]) {
	process.on(signal, async () => {
		await app.close();
		await pool.end();
		process.exit(0);
	});
}
