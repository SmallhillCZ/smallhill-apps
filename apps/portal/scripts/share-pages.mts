import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { APPS } from "../src/app/apps.ts";

const SITE = "https://apps.smallhill.cz";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const check = process.argv.includes("--check");

function escape(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

let outdated = 0;
for (const app of APPS.filter((app) => app.listed)) {
	const url = `${SITE}/app/${app.id}/`;
	const target = `/#${app.id}`;
	const title = escape(app.name.cs);
	const html = `<!doctype html>
<html lang="cs">
	<head>
		<meta charset="utf-8" />
		<title>${title} · Smallhill Apps</title>
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<meta name="description" content="${escape(app.tagline.cs)}" />
		<link rel="canonical" href="${url}" />
		<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
		<meta property="og:type" content="website" />
		<meta property="og:site_name" content="Smallhill Apps" />
		<meta property="og:locale" content="cs_CZ" />
		<meta property="og:url" content="${url}" />
		<meta property="og:title" content="${title}" />
		<meta property="og:description" content="${escape(app.description.cs)}" />
		<meta property="og:image" content="${SITE}/apps/${app.id}/og.png" />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
		<meta property="og:image:alt" content="${title}: ${escape(app.tagline.cs)}" />
		<meta name="twitter:card" content="summary_large_image" />
		<meta http-equiv="refresh" content="0; url=${target}" />
		<script>
			location.replace("${target}");
		</script>
	</head>
	<body>
		<a href="${target}">${title}</a>
	</body>
</html>
`;
	const file = join(ROOT, "app", app.id, "index.html");
	if (check) {
		if (!existsSync(file) || readFileSync(file, "utf8") !== html) {
			console.error(`Outdated share page: ${file}. Run npm run share-pages.`);
			outdated++;
		}
	} else {
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, html);
	}
}
process.exit(outdated ? 1 : 0);
