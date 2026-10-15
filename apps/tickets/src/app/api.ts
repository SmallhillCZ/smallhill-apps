import { Injectable, computed, signal } from "@angular/core";

export interface Ticket {
	id: string;
	name: string;
	venue: string;
	start: string | null;
	end: string | null;
	hasTime: boolean;
	count: number;
	paid: boolean;
	pdf: string | null;
	mobile: string | null;
}

export interface TicketImage {
	src: string;
	code?: string;
	qr?: boolean;
}

export type ApiError = "credentials" | "login" | "goout" | "offline" | "emailed" | "failed";

export class ApiFailure extends Error {
	constructor(readonly kind: ApiError) {
		super(kind);
	}
}

interface Cached {
	tickets: Ticket[];
	savedAt: string;
}

const SESSION_KEY = "tickets.session";
const LIST_KEY = "tickets.list";
const IMAGE_PREFIX = "tickets.img.";
const SESSION_HEADER = "x-goout-session";

function read<T>(key: string): T | null {
	try {
		const v = localStorage.getItem(key);
		return v ? (JSON.parse(v) as T) : null;
	} catch {
		return null;
	}
}

function write(key: string, value: unknown) {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, JSON.stringify(value));
	} catch {}
}

@Injectable({ providedIn: "root" })
export class Api {
	readonly session = signal<string | null>(read<string>(SESSION_KEY));
	readonly cached = signal<Cached | null>(read<Cached>(LIST_KEY));
	readonly loggedIn = computed(() => !!this.session());

	async login(email: string, password: string) {
		const res = await this.request("api/login", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email, password }),
		});
		if (res.status === 401) throw new ApiFailure("credentials");
		if (!res.ok) throw new ApiFailure("goout");
		const { session } = (await res.json()) as { session: string };
		this.setSession(session);
	}

	async logout() {
		const session = this.session();
		this.setSession(null);
		this.clearCache();
		if (session)
			await this.request("api/logout", { method: "POST", headers: { [SESSION_HEADER]: session } }).catch(
				() => {},
			);
	}

	async refresh(): Promise<Ticket[]> {
		const res = await this.authed("api/tickets");
		const { tickets } = (await res.json()) as { tickets: Ticket[] };
		const cached = { tickets, savedAt: new Date().toISOString() };
		this.cached.set(cached);
		write(LIST_KEY, cached);
		this.pruneImages(tickets);
		return tickets;
	}

	ticket(id: string): Ticket | undefined {
		return this.cached()?.tickets.find((t) => t.id === id);
	}

	savedImages(id: string): TicketImage[] | null {
		const saved = read<(string | TicketImage)[]>(IMAGE_PREFIX + id);
		return saved?.map((i) => (typeof i === "string" ? { src: i } : i)) ?? null;
	}

	async loadImages(ticket: Ticket): Promise<TicketImage[]> {
		const urls = [ticket.mobile, ticket.pdf].filter((u): u is string => !!u);
		if (!urls.length) throw new ApiFailure("failed");
		let failure: unknown = null;
		for (const url of urls) {
			try {
				const images = await this.fetchImages(url);
				write(IMAGE_PREFIX + ticket.id, images);
				return images;
			} catch (e) {
				if (e instanceof ApiFailure && (e.kind === "login" || e.kind === "offline")) throw e;
				failure ??= e;
			}
		}
		throw failure;
	}

	private async fetchImages(url: string): Promise<TicketImage[]> {
		const res = await this.authed(`api/ticket?url=${encodeURIComponent(url)}`);
		if (res.status === 202) throw new ApiFailure("emailed");
		const type = res.headers.get("content-type") ?? "";
		if (type.includes("json")) {
			const { codes } = (await res.json()) as { codes: { image: string; code: string }[] };
			return codes.map((c) => ({ src: c.image, code: c.code, qr: true }));
		}
		const data = new Uint8Array(await res.arrayBuffer());
		if (type.includes("pdf")) return (await renderPdf(data)).map((src) => ({ src }));
		return [{ src: await toDataUrl(new Blob([data], { type })) }];
	}

	private async authed(url: string) {
		const session = this.session();
		if (!session) throw new ApiFailure("login");
		const res = await this.request(url, { headers: { [SESSION_HEADER]: session } });
		const renewed = res.headers.get(SESSION_HEADER);
		if (renewed) this.setSession(renewed);
		if (res.status === 401) {
			this.setSession(null);
			throw new ApiFailure("login");
		}
		if (!res.ok) throw new ApiFailure("goout");
		return res;
	}

	private async request(url: string, init: RequestInit) {
		try {
			return await fetch(url, { ...init, cache: "no-store" });
		} catch {
			throw new ApiFailure("offline");
		}
	}

	private setSession(session: string | null) {
		this.session.set(session);
		write(SESSION_KEY, session);
	}

	private clearCache() {
		this.cached.set(null);
		write(LIST_KEY, null);
		this.pruneImages([]);
	}

	private pruneImages(keep: Ticket[]) {
		try {
			const ids = new Set(keep.map((t) => IMAGE_PREFIX + t.id));
			for (const key of Object.keys(localStorage)) {
				if (key.startsWith(IMAGE_PREFIX) && !ids.has(key)) localStorage.removeItem(key);
			}
		} catch {}
	}
}

async function renderPdf(data: Uint8Array): Promise<string[]> {
	const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
	pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdf.worker.min.mjs", document.baseURI).toString();
	const doc = await pdfjs.getDocument({ data }).promise;
	const images: string[] = [];
	for (let i = 1; i <= doc.numPages; i++) {
		const page = await doc.getPage(i);
		const base = page.getViewport({ scale: 1 });
		const viewport = page.getViewport({ scale: Math.min(3, 1400 / base.width) });
		const canvas = document.createElement("canvas");
		canvas.width = Math.ceil(viewport.width);
		canvas.height = Math.ceil(viewport.height);
		await page.render({ canvasContext: canvas.getContext("2d")!, viewport, background: "#ffffff" }).promise;
		images.push(trim(canvas).toDataURL("image/png"));
	}
	await doc.destroy();
	return images;
}

function trim(canvas: HTMLCanvasElement): HTMLCanvasElement {
	const { width, height } = canvas;
	const pixels = canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
	let top = height,
		left = width,
		right = -1,
		bottom = -1;
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 4;
			if (pixels[i] < 235 || pixels[i + 1] < 235 || pixels[i + 2] < 235) {
				if (y < top) top = y;
				if (y > bottom) bottom = y;
				if (x < left) left = x;
				if (x > right) right = x;
			}
		}
	}
	if (right < 0) return canvas;
	const pad = Math.round(width * 0.03);
	const x = Math.max(0, left - pad);
	const y = Math.max(0, top - pad);
	const w = Math.min(width, right + pad + 1) - x;
	const h = Math.min(height, bottom + pad + 1) - y;
	const out = document.createElement("canvas");
	out.width = w;
	out.height = h;
	const context = out.getContext("2d")!;
	context.fillStyle = "#ffffff";
	context.fillRect(0, 0, w, h);
	context.drawImage(canvas, x, y, w, h, 0, 0, w, h);
	return out;
}

function toDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}
