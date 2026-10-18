import { resolve } from "node:path";
import { buildApp } from "./app.ts";

const env = process.env;

const app = await buildApp({
	webRoot: env.WEB_ROOT ? resolve(env.WEB_ROOT) : undefined,
	basePath: env.BASE_PATH ?? "",
	googleUrl: env.GOOGLE_URL || undefined,
	logger: true,
});

await app.listen({ host: env.HOST ?? "0.0.0.0", port: Number(env.PORT ?? 3000) });

for (const signal of ["SIGINT", "SIGTERM"]) {
	process.on(signal, async () => {
		await app.close();
		process.exit(0);
	});
}
