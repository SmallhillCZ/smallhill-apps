import { TestBed } from "@angular/core/testing";
import { PlayerService } from "../player/player.service";
import { contentType, SonosService, TOKEN_KEY } from "./sonos.service";

describe("SonosService", () => {
	const track = (id: string, name = `${id}.mp3`, source = "drive") => ({
		id,
		name,
		title: id,
		artist: "",
		album: "",
		duration: 100,
		source,
		path: [],
	});
	let requests: { method: string; url: string; body: unknown; headers: Record<string, string> }[];
	let status: { state: string; itemId: string | null; positionMillis: number };

	beforeEach(() => {
		requests = [];
		status = { state: "PLAYBACK_STATE_PLAYING", itemId: null, positionMillis: 0 };
		localStorage.setItem(TOKEN_KEY, "sealed");
		vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {});
		vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
		vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
		vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
			const url = String(input);
			const body = init?.body ? JSON.parse(String(init.body)) : undefined;
			requests.push({
				method: init?.method ?? "GET",
				url,
				body,
				headers: (init?.headers ?? {}) as Record<string, string>,
			});
			const json = (data: unknown, code = 200) =>
				new Response(JSON.stringify(data), { status: code, headers: { "Content-Type": "application/json" } });
			if (url.endsWith("api/sonos/config")) return json({ enabled: true });
			if (url.endsWith("api/sonos/queues")) return json({ id: "Q", key: "K" }, 201);
			if (url.endsWith("/status")) return json(status);
			return json({});
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		localStorage.clear();
	});

	function setup() {
		const player = TestBed.inject(PlayerService);
		const sonos = TestBed.inject(SonosService);
		sonos.setSource({
			canPlay: (t) => t.source === "drive",
			streamUrl: async (t) => `https://od.example/${t.id}`,
		});
		player.setResolver(async (t) => `https://local.example/${t.id}`);
		return { player, sonos };
	}

	it("maps file names to content types Sonos can play", () => {
		expect(contentType("a.MP3")).toBe("audio/mpeg");
		expect(contentType("b.flac")).toBe("audio/flac");
		expect(contentType("c.weba")).toBeNull();
	});

	it("starts a cloud queue with only OneDrive tracks, from the current one", async () => {
		const { player, sonos } = setup();
		player.enqueue([track("a"), track("b", "b.mp3", "device"), track("c"), track("d", "d.opus")]);
		await vi.waitFor(() => expect(player.current()?.id).toBe("a"));
		await sonos.init();
		expect(sonos.enabled()).toBe(true);

		expect(await sonos.start({ id: "G1", name: "Kitchen", playbackState: null })).toBe(true);
		const create = requests.find((r) => r.url.endsWith("api/sonos/queues"))!;
		expect(create.headers["X-Sonos-Token"]).toBe("sealed");
		const body = create.body as {
			groupId: string;
			items: { id: string; url: string; type: string }[];
			itemId: string;
		};
		expect(body.groupId).toBe("G1");
		expect(body.items.map((i) => i.url)).toEqual(["https://od.example/a", "https://od.example/c"]);
		expect(body.itemId).toBe(body.items[0].id);
		expect(player.externalActive()).toBe(true);
		expect(sonos.group()?.name).toBe("Kitchen");

		player.next();
		await vi.waitFor(() => expect(requests.some((r) => r.url.endsWith("/control"))).toBe(true));
		const skip = requests.find((r) => r.url.endsWith("/control"))!;
		expect(skip.headers["X-Queue-Key"]).toBe("K");
		expect(skip.body).toEqual({ action: "skipToItem", itemId: body.items[1].id, positionMillis: 0, play: true });
		expect(player.current()?.id).toBe("c");
	});

	it("uploads queue changes while casting", async () => {
		const { player, sonos } = setup();
		player.enqueue([track("a")]);
		await vi.waitFor(() => expect(player.current()?.id).toBe("a"));
		await sonos.start({ id: "G1", name: "Kitchen", playbackState: null });
		player.enqueue([track("e")]);
		await vi.waitFor(() => expect(requests.some((r) => r.method === "PUT")).toBe(true));
		const put = requests.find((r) => r.method === "PUT")!;
		expect((put.body as { items: { url: string }[] }).items.map((i) => i.url)).toEqual([
			"https://od.example/a",
			"https://od.example/e",
		]);
	});

	it("refuses to cast when nothing can play on Sonos", async () => {
		const { player, sonos } = setup();
		player.enqueue([track("x", "x.mp3", "device")]);
		await vi.waitFor(() => expect(player.current()?.id).toBe("x"));
		expect(await sonos.start({ id: "G1", name: "Kitchen", playbackState: null })).toBe(false);
		expect(sonos.notice()).toBe("nothingPlayable");
		expect(player.externalActive()).toBe(false);
	});

	it("forgets the connection when the server asks to reconnect", async () => {
		const { sonos } = setup();
		vi.mocked(window.fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: "reconnect" }), { status: 401 }),
		);
		await sonos.loadGroups();
		expect(sonos.groupsFailed()).toBe(true);
		expect(sonos.connected()).toBe(false);
		expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
	});
});
