import { existsSync } from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import type pg from "pg";
import { registerSonos } from "./sonos.ts";

export interface AppOptions {
	pool: pg.Pool;
	basePath?: string;
	webRoot?: string;
	logger?: boolean;
	sonos?: { clientId?: string; clientSecret?: string; publicUrl?: string; fetch?: typeof fetch };
}

export async function buildApp({
	pool,
	webRoot,
	basePath = "",
	logger = false,
	sonos = {},
}: AppOptions): Promise<FastifyInstance> {
	const app = Fastify({ logger: logger ? { level: "warn" } : false, bodyLimit: 64 * 1024 });
	const base = basePath.replace(/\/+$/, "");
	const api = `${base}/api`;

	await registerSonos(app, base, { pool, ...sonos });

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
