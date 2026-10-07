import { Injectable, signal } from "@angular/core";
import { DriveItem } from "./items";
import { AuthStatus, DriveAccount } from "./auth-status";

const folder = (id: string, name: string, childCount: number): DriveItem => ({ id, name, folder: { childCount } });

const track = (id: string, n: number, title: string, artist: string, album: string, seconds: number): DriveItem => ({
	id,
	name: `${String(n).padStart(2, "0")} ${title}.mp3`,
	file: { mimeType: "audio/mpeg" },
	audio: { title, artist, album, track: n, duration: seconds * 1000 },
});

const TREE: Record<string, DriveItem[]> = {
	root: [
		folder("music", "Music", 4),
		folder("podcasts", "Podcasts", 2),
		folder("docs", "Documents", 12),
		{ id: "cv", name: "CV.pdf", file: { mimeType: "application/pdf" } },
	],
	music: [
		folder("album1", "Northern Lights", 6),
		folder("album2", "Harbour Songs", 5),
		folder("album3", "Live at the Mill", 8),
		folder("album4", "Quiet Hours", 7),
	],
	album1: [
		track("t1", 1, "First Light", "The Lanterns", "Northern Lights", 214),
		track("t2", 2, "Across the Fjord", "The Lanterns", "Northern Lights", 251),
		track("t3", 3, "Paper Boats", "The Lanterns", "Northern Lights", 187),
		track("t4", 4, "Midnight Ferry", "The Lanterns", "Northern Lights", 302),
		track("t5", 5, "Aurora", "The Lanterns", "Northern Lights", 268),
		track("t6", 6, "Homeward", "The Lanterns", "Northern Lights", 236),
		{ id: "cover", name: "cover.jpg", file: { mimeType: "image/jpeg" } },
	],
	podcasts: [
		track("p1", 1, "Episode 41: Slow Travel", "Weekend Radio", "Weekend Radio", 2710),
		track("p2", 2, "Episode 42: Night Trains", "Weekend Radio", "Weekend Radio", 3105),
	],
};

function tone(seconds: number): string {
	const rate = 8000;
	const samples = rate * seconds;
	const buffer = new ArrayBuffer(44 + samples);
	const view = new DataView(buffer);
	const text = (offset: number, value: string) =>
		[...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
	text(0, "RIFF");
	view.setUint32(4, 36 + samples, true);
	text(8, "WAVEfmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, rate, true);
	view.setUint32(28, rate, true);
	view.setUint16(32, 1, true);
	view.setUint16(34, 8, true);
	text(36, "data");
	view.setUint32(40, samples, true);
	for (let i = 0; i < samples; i++)
		view.setUint8(44 + i, 128 + Math.round(20 * Math.sin((i / rate) * 2 * Math.PI * 220)));
	return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

const DEMO_ACCOUNTS: DriveAccount[] = [
	{ id: "demo-personal", name: "Jana Nováková", username: "jana@example.com" },
	{ id: "demo-work", name: "Jana Nováková", username: "jana@work.example.com" },
];
const STORAGE_KEY = "player.demo.accounts";

function storedAccounts(): DriveAccount[] {
	try {
		const ids = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as string[];
		return DEMO_ACCOUNTS.filter((account) => ids.includes(account.id));
	} catch {
		return [];
	}
}

@Injectable({ providedIn: "root" })
export class OneDriveService {
	readonly status = signal<AuthStatus>("ready");
	readonly accounts = signal<DriveAccount[]>(storedAccounts());
	readonly signedIn = signal<DriveAccount | null>(null);

	async addAccount(): Promise<void> {
		const next = DEMO_ACCOUNTS.find((account) => !this.accounts().some((a) => a.id === account.id));
		if (!next) return;
		this.save([...this.accounts(), next]);
		this.signedIn.set(next);
	}

	async signIn(accountId: string): Promise<void> {
		const account = DEMO_ACCOUNTS.find((a) => a.id === accountId);
		if (account && !this.accounts().includes(account)) this.save([...this.accounts(), account]);
	}

	async removeAccount(accountId: string): Promise<void> {
		this.save(this.accounts().filter((account) => account.id !== accountId));
	}

	private save(accounts: DriveAccount[]): void {
		this.accounts.set(accounts);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts.map((account) => account.id)));
	}

	async children(_accountId: string, folderId: string | null): Promise<DriveItem[]> {
		return TREE[folderId ?? "root"] ?? [];
	}

	async downloadUrl(_accountId: string, id: string): Promise<string> {
		const item = Object.values(TREE)
			.flat()
			.find((i) => i.id === id);
		return tone(Math.round((item?.audio?.duration ?? 30000) / 1000));
	}

	async streamUrl(_accountId: string, id: string): Promise<string | null> {
		return `https://example.com/demo/${encodeURIComponent(id)}.wav`;
	}
}
