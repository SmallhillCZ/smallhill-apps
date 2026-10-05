export interface DriveItem {
	id: string;
	name: string;
	size?: number;
	folder?: { childCount: number };
	file?: { mimeType?: string };
	audio?: {
		title?: string;
		artist?: string;
		album?: string;
		albumArtist?: string;
		duration?: number;
		track?: number;
		disc?: number;
	};
}

export interface Folder {
	id: string;
	name: string;
}

export interface Track {
	id: string;
	name: string;
	title: string;
	artist: string;
	album: string;
	duration: number | null;
}

const AUDIO_EXTENSIONS = ["mp3", "m4a", "aac", "ogg", "oga", "opus", "wav", "flac", "weba"];

export function extension(name: string): string {
	const dot = name.lastIndexOf(".");
	return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

export function isAudio(item: DriveItem): boolean {
	if (!item.file) return false;
	return AUDIO_EXTENSIONS.includes(extension(item.name)) || !!item.file.mimeType?.startsWith("audio/");
}

export function toTrack(item: DriveItem): Track {
	const dot = item.name.lastIndexOf(".");
	const base = dot > 0 ? item.name.slice(0, dot) : item.name;
	return {
		id: item.id,
		name: item.name,
		title: item.audio?.title?.trim() || base,
		artist: item.audio?.artist?.trim() || item.audio?.albumArtist?.trim() || "",
		album: item.audio?.album?.trim() || "",
		duration: item.audio?.duration ? item.audio.duration / 1000 : null,
	};
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

export function sortFolders(items: DriveItem[]): DriveItem[] {
	return items.filter((item) => item.folder).sort((a, b) => collator.compare(a.name, b.name));
}

export function sortTracks(items: DriveItem[]): DriveItem[] {
	return items
		.filter(isAudio)
		.sort(
			(a, b) =>
				(a.audio?.disc ?? 0) - (b.audio?.disc ?? 0) ||
				(a.audio?.track ?? 0) - (b.audio?.track ?? 0) ||
				collator.compare(a.name, b.name),
		);
}

export function formatTime(seconds: number | null | undefined): string {
	if (seconds === null || seconds === undefined || !isFinite(seconds) || seconds < 0) return "–:––";
	const total = Math.floor(seconds);
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = String(total % 60).padStart(2, "0");
	return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
