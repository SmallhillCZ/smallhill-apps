import { analyze, INSTRUMENTS, midiToFrequency, nearestString, noteInfo } from "./notes";

describe("notes", () => {
	const guitar = INSTRUMENTS.find((i) => i.id === "guitar")!.strings;

	it("converts midi to frequency", () => {
		expect(midiToFrequency(69)).toBeCloseTo(440);
		expect(midiToFrequency(40)).toBeCloseTo(82.41, 1);
		expect(midiToFrequency(69, 442)).toBeCloseTo(442);
	});

	it("names notes", () => {
		expect(noteInfo(40)).toEqual({ midi: 40, name: "E", octave: 2 });
		expect(noteInfo(61)).toEqual({ midi: 61, name: "C♯", octave: 4 });
	});

	it("finds the nearest string", () => {
		expect(nearestString(85, guitar)).toBe(40);
		expect(nearestString(140, guitar)).toBe(50);
	});

	it("reports cents relative to the nearest string", () => {
		const reading = analyze(112, 440, guitar, null);
		expect(reading.target.name).toBe("A");
		expect(reading.cents).toBeGreaterThan(31);
		expect(reading.cents).toBeLessThan(32);
	});

	it("respects a locked string", () => {
		expect(analyze(112, 440, guitar, 40).target.name).toBe("E");
	});

	it("uses the nearest semitone in chromatic mode", () => {
		const reading = analyze(277.18, 440, [], null);
		expect(reading.target.name).toBe("C♯");
		expect(Math.abs(reading.cents)).toBeLessThan(1);
	});
});
