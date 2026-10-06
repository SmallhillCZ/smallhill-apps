import { loadSources, locationFromUrl, locationToUrl, rootLabel, saveSources } from "./sources";

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

	it("keeps the top folder of a source", () => {
		const root = [
			{ id: "1", name: "Music" },
			{ id: "2", name: "Classical" },
		];
		saveSources([{ id: "a", kind: "onedrive", name: "OneDrive", account: "acc", root }]);
		const [source] = loadSources()!;
		expect(source.root).toEqual(root);
		expect(rootLabel(source)).toBe("Music / Classical");
		localStorage.setItem(
			"player.sources",
			JSON.stringify([{ id: "a", kind: "device", name: "x", root: [{ id: 1 }] }]),
		);
		expect(loadSources()).toEqual([]);
	});

	it("keeps the folder path in the URL", () => {
		const path = [
			{ id: "src", name: "OneDrive" },
			{ id: "A!1", name: "Music & more" },
		];
		const url = locationToUrl("https://apps.example/player/?path=x#code=1", { path, picking: false });
		expect(url.startsWith("https://apps.example/player/?path=")).toBe(true);
		expect(url).not.toContain("#");
		expect(locationFromUrl(url)).toEqual({ path, picking: false });
		expect(locationFromUrl(locationToUrl(url, { path, picking: true }))?.picking).toBe(true);
		expect(locationToUrl(url, { path: [], picking: false })).toBe("https://apps.example/player/");
		expect(locationFromUrl("https://apps.example/player/?path=%5B1%5D")).toBeNull();
	});
});
