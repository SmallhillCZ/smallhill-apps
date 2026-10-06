import { loadMusicFolder, loadSources, samePath, saveMusicFolder, saveSources } from "./sources";

describe("sources", () => {
	afterEach(() => localStorage.clear());

	it("round-trips sources and drops invalid entries", () => {
		saveSources([
			{ id: "a", kind: "onedrive", name: "OneDrive", account: "acc" },
			{ id: "b", kind: "device", name: "Music" },
		]);
		expect(loadSources()).toHaveLength(2);
		localStorage.setItem("player.sources", JSON.stringify([{ id: "x", kind: "ftp", name: "?" }]));
		expect(loadSources()).toEqual([]);
	});

	it("returns null before any source was saved", () => {
		expect(loadSources()).toBeNull();
	});

	it("stores the music folder path", () => {
		saveMusicFolder([
			{ id: "b", name: "Music" },
			{ id: "Rock", name: "Rock" },
		]);
		expect(loadMusicFolder()).toEqual([
			{ id: "b", name: "Music" },
			{ id: "Rock", name: "Rock" },
		]);
		saveMusicFolder(null);
		expect(loadMusicFolder()).toBeNull();
	});

	it("compares paths by id", () => {
		expect(samePath([{ id: "a", name: "A" }], [{ id: "a", name: "renamed" }])).toBe(true);
		expect(samePath([{ id: "a", name: "A" }], [])).toBe(false);
	});
});
