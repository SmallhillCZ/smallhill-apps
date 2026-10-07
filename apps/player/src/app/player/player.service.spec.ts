import { TestBed } from "@angular/core/testing";
import { PlayerService } from "./player.service";

describe("PlayerService", () => {
	const downloadUrl = vi.fn(async (track: { id: string }) => `https://files.example/${track.id}`);
	let audio: HTMLAudioElement;

	beforeEach(() => {
		downloadUrl.mockClear();
		vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async function (this: HTMLMediaElement) {
			audio = this as HTMLAudioElement;
		});
		vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
		vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
	});

	afterEach(() => vi.restoreAllMocks());

	const track = { id: "t1", name: "a.mp3", title: "a", artist: "", album: "", duration: 60, source: "s", path: [] };

	it("plays from a fresh download URL", async () => {
		const player = TestBed.inject(PlayerService);
		player.setResolver(downloadUrl);
		player.playList([track], 0);
		await vi.waitFor(() => expect(audio?.src).toBe("https://files.example/t1"));
		expect(downloadUrl).toHaveBeenCalledTimes(1);
	});

	it("retries a failing track once and then stops", async () => {
		const player = TestBed.inject(PlayerService);
		player.setResolver(downloadUrl);
		player.playList([track], 0);
		await vi.waitFor(() => expect(downloadUrl).toHaveBeenCalledTimes(1));
		await vi.waitFor(() => expect(audio?.src).toContain("t1"));
		audio.dispatchEvent(new Event("error"));
		await vi.waitFor(() => expect(downloadUrl).toHaveBeenCalledTimes(2));
		audio.dispatchEvent(new Event("error"));
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(downloadUrl).toHaveBeenCalledTimes(2);
		expect(player.error()).toBe(true);
	});

	it("adds tracks to the queue and removes them", async () => {
		const player = TestBed.inject(PlayerService);
		player.setResolver(downloadUrl);
		const other = (id: string) => ({ ...track, id, source: "other" });
		player.enqueue([track]);
		await vi.waitFor(() => expect(player.current()?.id).toBe("t1"));
		expect(player.playing()).toBe(false);
		player.enqueue([other("t2"), other("t3")]);
		expect(player.upcoming().map((item) => item.track.id)).toEqual(["t1", "t2", "t3"]);
		player.removeAt(1);
		expect(player.upcoming().map((item) => item.track.id)).toEqual(["t1", "t3"]);
		player.jump(1);
		await vi.waitFor(() => expect(audio?.src).toBe("https://files.example/t3"));
		player.removeSource("other");
		expect(player.current()).toBeNull();
	});

	it("puts played tracks first, replacing the current one once it has started", async () => {
		const player = TestBed.inject(PlayerService);
		player.setResolver(downloadUrl);
		const ids = () => player.upcoming().map((item) => item.track.id);
		player.enqueue([track, { ...track, id: "t2" }, { ...track, id: "t3" }]);
		await vi.waitFor(() => expect(player.current()?.id).toBe("t1"));
		player.playNow([{ ...track, id: "t3" }]);
		expect(ids()).toEqual(["t3", "t1", "t2", "t3"]);
		expect(player.current()?.id).toBe("t3");
		await vi.waitFor(() => expect(audio?.src).toBe("https://files.example/t3"));
		audio.dispatchEvent(new Event("playing"));
		let resolve: (url: string) => void = () => {};
		downloadUrl.mockImplementationOnce(() => new Promise((r) => (resolve = r)));
		player.playNow([
			{ ...track, id: "t4" },
			{ ...track, id: "t5" },
		]);
		expect(ids()).toEqual(["t4", "t5", "t1", "t2", "t3"]);
		expect(audio.getAttribute("src")).toBeNull();
		resolve("https://files.example/t4");
		await vi.waitFor(() => expect(audio.src).toBe("https://files.example/t4"));
		player.clearQueue();
		expect(ids()).toEqual(["t4"]);
		expect(player.current()?.id).toBe("t4");
		expect(audio.src).toBe("https://files.example/t4");
	});

	it("restores a session paused without loading the audio", async () => {
		const player = TestBed.inject(PlayerService);
		player.setResolver(downloadUrl);
		player.restore([track, { ...track, id: "t2" }], { order: [0, 1], pos: 1 }, 42);
		expect(player.current()?.id).toBe("t2");
		expect(player.time()).toBe(42);
		expect(player.playing()).toBe(false);
		expect(downloadUrl).not.toHaveBeenCalled();
		player.toggle();
		await vi.waitFor(() => expect(downloadUrl).toHaveBeenCalledTimes(1));
		expect(player.time()).toBe(42);
	});

	it("shares the queue with another tab and forwards its controls", async () => {
		const first = TestBed.runInInjectionContext(() => new PlayerService());
		const second = TestBed.runInInjectionContext(() => new PlayerService());
		first.setResolver(downloadUrl);
		second.setResolver(downloadUrl);
		first.playList([track, { ...track, id: "t2" }], 0);
		await vi.waitFor(() => expect(audio?.src).toBe("https://files.example/t1"));
		const pause = vi.mocked(HTMLMediaElement.prototype.pause);
		audio.dispatchEvent(new Event("playing"));
		await vi.waitFor(() => expect(second.remote()).toBe(true));
		await vi.waitFor(() => expect(second.current()?.id).toBe("t1"));
		expect(second.playing()).toBe(true);
		pause.mockClear();
		Object.defineProperty(audio, "paused", { value: false, configurable: true });
		second.toggle();
		await vi.waitFor(() => expect(pause).toHaveBeenCalled());
		second.next();
		await vi.waitFor(() => expect(first.current()?.id).toBe("t2"));
		await vi.waitFor(() => expect(second.current()?.id).toBe("t2"));
	});
	it("hands playback to an external output and back", async () => {
		const player = TestBed.inject(PlayerService);
		player.setResolver(downloadUrl);
		const output = {
			load: vi.fn(async () => {}),
			play: vi.fn(),
			pause: vi.fn(),
			seek: vi.fn(),
			stop: vi.fn(),
		};
		player.enqueue([track, { ...track, id: "t2" }]);
		await vi.waitFor(() => expect(player.current()?.id).toBe("t1"));
		player.setExternal(output);
		expect(player.externalActive()).toBe(true);

		player.next();
		await vi.waitFor(() => expect(output.load).toHaveBeenCalledWith(1, 0, true));
		expect(downloadUrl).toHaveBeenCalledTimes(1);

		player.updateExternal({ pos: 1, time: 12, playing: true, loading: false });
		expect(player.playing()).toBe(true);
		expect(player.time()).toBe(12);
		player.toggle();
		expect(output.pause).toHaveBeenCalled();
		player.seek(30);
		expect(output.seek).toHaveBeenCalledWith(30);

		player.updateExternal({ pos: 0, time: 3, playing: true, loading: false });
		expect(player.current()?.id).toBe("t1");

		player.setExternal(null);
		expect(player.playing()).toBe(false);
		player.toggle();
		await vi.waitFor(() => expect(audio?.src).toBe("https://files.example/t1"));
		expect(audio.currentTime).toBe(3);
	});
});
