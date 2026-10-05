import { loadLibrary, loadPaths, saveLibrary, savePaths } from "./library";

describe("library settings", () => {
	afterEach(() => localStorage.clear());

	it("migrates the old OneDrive-only format", () => {
		localStorage.setItem("player.library", JSON.stringify([{ id: "m", name: "Music" }]));
		localStorage.setItem("player.path", JSON.stringify([{ id: "a", name: "Album" }]));
		expect(loadLibrary()).toEqual({ source: "onedrive", path: [{ id: "m", name: "Music" }] });
		expect(loadPaths()).toEqual({ onedrive: [{ id: "a", name: "Album" }], device: [] });
	});

	it("round-trips a device library", () => {
		saveLibrary({ source: "device", path: [{ id: "Rock", name: "Rock" }] });
		savePaths({ onedrive: [], device: [{ id: "Rock", name: "Rock" }] });
		expect(loadLibrary()).toEqual({ source: "device", path: [{ id: "Rock", name: "Rock" }] });
		expect(loadPaths().device).toEqual([{ id: "Rock", name: "Rock" }]);
		saveLibrary(null);
		expect(loadLibrary()).toBeNull();
	});
});
