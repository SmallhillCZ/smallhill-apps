import { loadSources, rootLabel, saveSources } from "./sources";

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
});
