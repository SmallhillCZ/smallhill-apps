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
		player.playNow(other("t4"));
		expect(player.upcoming().map((item) => item.track.id)).toEqual(["t1", "t3", "t4"]);
		expect(player.current()?.id).toBe("t4");
		player.enqueue([other("t5"), other("t6")]);
		player.playNow(other("t6"));
		expect(player.upcoming().map((item) => item.track.id)).toEqual(["t1", "t3", "t4", "t6", "t5"]);
		expect(player.current()?.id).toBe("t6");
		player.playNow(other("t3"));
		expect(player.upcoming().map((item) => item.track.id)).toEqual(["t1", "t4", "t6", "t3", "t5"]);
		expect(player.current()?.id).toBe("t3");
		player.removeSource("other");
		expect(player.current()).toBeNull();
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
});
