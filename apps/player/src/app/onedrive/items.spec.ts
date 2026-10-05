import { DriveItem, formatTime, isAudio, sortFolders, sortTracks, toTrack } from "./items";

describe("items", () => {
	it("recognizes audio files by extension or mime type", () => {
		expect(isAudio({ id: "1", name: "Song.MP3", file: {} })).toBe(true);
		expect(isAudio({ id: "2", name: "voice", file: { mimeType: "audio/mpeg" } })).toBe(true);
		expect(isAudio({ id: "3", name: "cover.jpg", file: { mimeType: "image/jpeg" } })).toBe(false);
		expect(isAudio({ id: "4", name: "Album.mp3", folder: { childCount: 1 } })).toBe(false);
	});

	it("uses tags for the track and falls back to the file name", () => {
		const tagged = toTrack({
			id: "1",
			name: "01.mp3",
			file: {},
			audio: { title: "Intro", artist: "Band", album: "First", duration: 61000 },
		});
		expect(tagged).toEqual({
			id: "1",
			name: "01.mp3",
			title: "Intro",
			artist: "Band",
			album: "First",
			duration: 61,
		});
		expect(toTrack({ id: "2", name: "My song.mp3", file: {} }).title).toBe("My song");
	});

	it("sorts folders by name and tracks by disc, track and name", () => {
		const items: DriveItem[] = [
			{ id: "a", name: "Folder 10", folder: { childCount: 0 } },
			{ id: "b", name: "Folder 2", folder: { childCount: 0 } },
			{ id: "c", name: "b.mp3", file: {}, audio: { track: 2 } },
			{ id: "d", name: "a.mp3", file: {}, audio: { track: 3 } },
			{ id: "e", name: "z.mp3", file: {}, audio: { track: 1 } },
			{ id: "f", name: "notes.txt", file: {} },
		];
		expect(sortFolders(items).map((i) => i.id)).toEqual(["b", "a"]);
		expect(sortTracks(items).map((i) => i.id)).toEqual(["e", "c", "d"]);
	});

	it("formats times", () => {
		expect(formatTime(0)).toBe("0:00");
		expect(formatTime(65.4)).toBe("1:05");
		expect(formatTime(3725)).toBe("1:02:05");
		expect(formatTime(NaN)).toBe("–:––");
		expect(formatTime(null)).toBe("–:––");
	});
});
