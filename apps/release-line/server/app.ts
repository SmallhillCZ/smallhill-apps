import { existsSync } from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";

export const GITHUB_CLIENT_ID = "Ov23liQxQft0mOoICDaJ";
export const SCOPE = "repo";

export interface AppOptions {
	basePath?: string;
	webRoot?: string;
	logger?: boolean;
	clientId?: string;
	githubUrl?: string;
	fetch?: typeof fetch;
}

export async function buildApp({
	basePath = "",
	webRoot,
	logger = false,
	clientId = GITHUB_CLIENT_ID,
	githubUrl = "https://github.com",
	fetch: doFetch = fetch,
}: AppOptions = {}): Promise<FastifyInstance> {
	const app = Fastify({ logger: logger ? { level: "warn" } : false, bodyLimit: 4 * 1024 });
	const base = basePath.replace(/\/+$/, "");
	const api = `${base}/api`;

	const post = async (path: string, body: Record<string, string>) => {
		const res = await doFetch(new URL(path, githubUrl), {
			method: "POST",
			headers: { Accept: "application/json", "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
		return { ok: res.ok && !!data, data: data ?? {} };
	};

	app.get(`${api}/auth`, async () => ({ deviceFlow: !!clientId }));

	app.post(`${api}/device/code`, async (_, reply) => {
		if (!clientId) return reply.code(404).send({ error: "disabled" });
		const { ok, data } = await post("/login/device/code", { client_id: clientId, scope: SCOPE });
		if (!ok || typeof data["device_code"] !== "string") return reply.code(502).send({ error: "github" });
		return {
			deviceCode: data["device_code"],
			userCode: data["user_code"],
			verificationUri: data["verification_uri"],
			expiresIn: data["expires_in"],
			interval: data["interval"],
		};
	});

	app.post<{ Body: { deviceCode: string } }>(
		`${api}/device/token`,
		{
			schema: {
				body: {
					type: "object",
					required: ["deviceCode"],
					additionalProperties: false,
					properties: { deviceCode: { type: "string", minLength: 1, maxLength: 200 } },
				},
			},
		},
		async (req, reply) => {
			if (!clientId) return reply.code(404).send({ error: "disabled" });
			const { ok, data } = await post("/login/oauth/access_token", {
				client_id: clientId,
				device_code: req.body.deviceCode,
				grant_type: "urn:ietf:params:oauth:grant-type:device_code",
			});
			if (!ok) return reply.code(502).send({ error: "github" });
			reply.header("cache-control", "no-store");
			if (typeof data["access_token"] === "string") return { token: data["access_token"] };
			return { error: typeof data["error"] === "string" ? data["error"] : "failed", interval: data["interval"] };
		},
	);

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
