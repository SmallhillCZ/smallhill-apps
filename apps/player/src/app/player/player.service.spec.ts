import { TestBed } from "@angular/core/testing";
import { PlayerService } from "./player.service";

describe("PlayerService", () => {
	const downloadUrl = vi.fn(async (id: string) => `https://files.example/${id}`);
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

	const track = { id: "t1", name: "a.mp3", title: "a", artist: "", album: "", duration: 60 };

	it("plays from a fresh download URL", async () => {
		const player = TestBed.inject(PlayerService);
		player.playList([track], 0, { downloadUrl });
		await vi.waitFor(() => expect(audio?.src).toBe("https://files.example/t1"));
		expect(downloadUrl).toHaveBeenCalledTimes(1);
	});

	it("retries a failing track once and then stops", async () => {
		const player = TestBed.inject(PlayerService);
		player.playList([track], 0, { downloadUrl });
		await vi.waitFor(() => expect(downloadUrl).toHaveBeenCalledTimes(1));
		await vi.waitFor(() => expect(audio?.src).toContain("t1"));
		audio.dispatchEvent(new Event("error"));
		await vi.waitFor(() => expect(downloadUrl).toHaveBeenCalledTimes(2));
		audio.dispatchEvent(new Event("error"));
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(downloadUrl).toHaveBeenCalledTimes(2);
		expect(player.error()).toBe(true);
	});
});
