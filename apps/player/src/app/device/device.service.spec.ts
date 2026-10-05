import { buildTree } from "./device.service";

const file = (path: string, type = "") => {
	const f = new File(["x"], path.split("/").at(-1)!, { type });
	Object.defineProperty(f, "webkitRelativePath", { value: path });
	return f;
};

describe("buildTree", () => {
	it("builds folders and audio files from a picked directory", () => {
		const { folders, files } = buildTree([
			file("Music/Album/01 Intro.mp3", "audio/mpeg"),
			file("Music/Album/cover.jpg", "image/jpeg"),
			file("Music/Single.m4a"),
			file("Music/.hidden/secret.mp3"),
		]);
		expect(folders.get("")?.map((i) => i.id)).toEqual(["Album", "Single.m4a"]);
		expect(folders.get("Album")?.map((i) => i.name)).toEqual(["01 Intro.mp3"]);
		expect([...files.keys()]).toEqual(["Album/01 Intro.mp3", "Single.m4a"]);
	});
});
