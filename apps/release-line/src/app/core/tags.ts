const VERSION = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;

export function isVersionTag(name: string): boolean {
	return VERSION.test(name);
}

export function parseFilter(text: string): string[] {
	return text
		.split(/[,\s]+/)
		.map((p) => p.trim())
		.filter(Boolean);
}

function globToRegExp(glob: string): RegExp {
	const body = glob
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, ".*")
		.replace(/\?/g, ".");
	return new RegExp(`^${body}$`);
}

export function matchesFilter(name: string, patterns: string[]): boolean {
	return patterns.some((p) => globToRegExp(p).test(name));
}

export function releaseTagNames(names: string[], patterns: string[]): string[] {
	const pool = patterns.length ? names.filter((n) => matchesFilter(n, patterns)) : names;
	return pool.filter((n) => !isVersionTag(n));
}

export function shownTagNames(names: string[], patterns: string[]): string[] {
	return patterns.length ? names.filter((n) => matchesFilter(n, patterns)) : names;
}

export type Bump = "major" | "minor" | "patch";

export function latestVersion(names: string[]): string | null {
	let best: { name: string; parts: number[] } | null = null;
	for (const name of names) {
		const m = VERSION.exec(name);
		if (!m || name.includes("-")) continue;
		const parts = [Number(m[1]), Number(m[2]), Number(m[3])];
		if (!best || compare(parts, best.parts) > 0) best = { name, parts };
	}
	return best?.name ?? null;
}

function compare(a: number[], b: number[]): number {
	for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
	return 0;
}

export function bumpVersion(current: string | null, bump: string): string | null {
	const m = VERSION.exec(current ?? "v0.0.0");
	if (!m) return null;
	const prefix = (current ?? "v").startsWith("v") ? "v" : "";
	let [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
	if (bump === "major") [major, minor, patch] = [major + 1, 0, 0];
	else if (bump === "minor") [minor, patch] = [minor + 1, 0];
	else if (bump === "patch") patch += 1;
	else return current;
	return `${prefix}${major}.${minor}.${patch}`;
}

export const TAG_COLORS = ["#2b8a3e", "#f59f00", "#d6336c", "#1971c2", "#7048e8", "#0c8599", "#e8590c"];

export function tagColor(name: string, preset?: string): string {
	if (preset && /^#[0-9a-f]{6}$/i.test(preset)) return preset;
	const n = name.toUpperCase();
	if (/PROD|LIVE|MAIN|STABLE/.test(n)) return TAG_COLORS[0];
	if (/NEXT|STAG|BETA|PREVIEW|TEST/.test(n)) return TAG_COLORS[1];
	if (/DEV|ALPHA|NIGHTLY/.test(n)) return TAG_COLORS[3];
	let h = 0;
	for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
	return TAG_COLORS[2 + (h % (TAG_COLORS.length - 2))];
}

export function readableText(bg: string): string {
	const v = parseInt(bg.slice(1), 16);
	const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	return lum > 0.32 ? "#1d1600" : "#ffffff";
}
