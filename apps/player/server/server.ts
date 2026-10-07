import { resolve } from "node:path";
import pg from "pg";
import { buildApp } from "./app.ts";
import { purgeOldQueues } from "./sonos.ts";

const env = process.env;
const pool = new pg.Pool({
	connectionString: env.DATABASE_URL ?? "postgres://player:player@localhost:5432/player",
});
pool.on("error", (error) => app.log.error(error));

const app = await buildApp({
	pool,
	webRoot: env.WEB_ROOT ? resolve(env.WEB_ROOT) : undefined,
	basePath: env.BASE_PATH ?? "",
	logger: true,
	sonos: {
		clientId: env.SONOS_CLIENT_ID,
		clientSecret: env.SONOS_CLIENT_SECRET,
		publicUrl: env.PUBLIC_URL,
	},
});

if (env.SONOS_CLIENT_ID && env.SONOS_CLIENT_SECRET) {
	const purge = () => purgeOldQueues(pool, 2).catch((e) => app.log.warn(e));
	setTimeout(purge, 60 * 1000).unref();
	setInterval(purge, 6 * 60 * 60 * 1000).unref();
}

await app.listen({ host: env.HOST ?? "0.0.0.0", port: Number(env.PORT ?? 3000) });

for (const signal of ["SIGINT", "SIGTERM"]) {
	process.on(signal, async () => {
		await app.close();
		await pool.end();
		process.exit(0);
	});
}
