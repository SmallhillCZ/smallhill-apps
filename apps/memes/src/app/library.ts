export interface MemeMeta {
	id: string;
	type: string;
	name: string;
	title: string;
	tags: string[];
	added: number;
	used: number;
	uses: number;
	updated?: number;
}

export interface Meme extends MemeMeta {
	blob: Blob;
}

export const UNTAGGED = "\u0000untagged";

export function fold(text: string): string {
	return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export function parseTags(input: string): string[] {
	const tags: string[] = [];
	for (const raw of input.split(/[,;#\n]+/)) {
		const tag = raw.trim().replace(/\s+/g, " ").toLowerCase();
		if (tag && !tags.includes(tag)) tags.push(tag);
	}
	return tags;
}

export function addTags(tags: string[], extra: string[]): string[] {
	const result = [...tags];
	for (const tag of extra) if (!result.includes(tag)) result.push(tag);
	return result;
}

export function titleFromName(name: string): string {
	return name
		.replace(/\.[a-z0-9]{2,5}$/i, "")
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function matches(meme: MemeMeta, query: string, selected: readonly string[]): boolean {
	for (const tag of selected) {
		if (tag === UNTAGGED) {
			if (meme.tags.length) return false;
		} else if (!meme.tags.includes(tag)) return false;
	}
	const words = fold(query).split(/\s+/).filter(Boolean);
	if (!words.length) return true;
	const haystack = [meme.title, ...meme.tags].map(fold);
	return words.every((word) => haystack.some((text) => text.includes(word)));
}

export function lastTouched(meme: MemeMeta): number {
	return Math.max(meme.added, meme.used);
}

export function sortMemes<T extends MemeMeta>(memes: T[]): T[] {
	return [...memes].sort((a, b) => lastTouched(b) - lastTouched(a) || b.added - a.added);
}

export function tagCounts(memes: readonly MemeMeta[]): { tag: string; count: number }[] {
	const counts = new Map<string, number>();
	for (const meme of memes) for (const tag of meme.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
	return [...counts]
		.map(([tag, count]) => ({ tag, count }))
		.sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

const EXTENSIONS: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/gif": "gif",
	"image/webp": "webp",
	"image/avif": "avif",
	"image/svg+xml": "svg",
	"image/bmp": "bmp",
	"video/mp4": "mp4",
	"video/webm": "webm",
	"video/quicktime": "mov",
};

const TYPES: Record<string, string> = Object.fromEntries(Object.entries(EXTENSIONS).map(([t, e]) => [e, t]));
TYPES["jpeg"] = "image/jpeg";

export function extensionOf(type: string, name = ""): string {
	return EXTENSIONS[type] ?? name.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() ?? "bin";
}

export function typeOf(name: string, type = ""): string {
	if (type && type !== "application/octet-stream") return type;
	return TYPES[name.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() ?? ""] ?? type;
}

export function isMedia(type: string): boolean {
	return type.startsWith("image/") || type.startsWith("video/");
}

export function fileName(meme: Pick<MemeMeta, "title" | "type" | "name" | "id">): string {
	const base =
		fold(meme.title)
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 60) || "meme";
	return `${base}.${extensionOf(meme.type, meme.name)}`;
}

export function newId(): string {
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
