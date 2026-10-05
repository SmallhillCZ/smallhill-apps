export const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"] as const;

export type InstrumentId = "guitar" | "bass" | "violin" | "chromatic";

export interface Instrument {
	id: InstrumentId;
	strings: number[];
	minFrequency: number;
	maxFrequency: number;
}

export const INSTRUMENTS: Instrument[] = [
	{ id: "guitar", strings: [40, 45, 50, 55, 59, 64], minFrequency: 60, maxFrequency: 1400 },
	{ id: "bass", strings: [28, 33, 38, 43], minFrequency: 30, maxFrequency: 500 },
	{ id: "violin", strings: [55, 62, 69, 76], minFrequency: 150, maxFrequency: 2800 },
	{ id: "chromatic", strings: [], minFrequency: 30, maxFrequency: 2800 },
];

export interface NoteInfo {
	midi: number;
	name: string;
	octave: number;
}

export interface Reading {
	frequency: number;
	target: NoteInfo;
	targetFrequency: number;
	cents: number;
}

export function midiToFrequency(midi: number, a4 = 440): number {
	return a4 * Math.pow(2, (midi - 69) / 12);
}

export function frequencyToMidi(frequency: number, a4 = 440): number {
	return 69 + 12 * Math.log2(frequency / a4);
}

export function noteInfo(midi: number): NoteInfo {
	return { midi, name: NOTE_NAMES[((midi % 12) + 12) % 12], octave: Math.floor(midi / 12) - 1 };
}

export function nearestString(frequency: number, strings: number[], a4 = 440): number | null {
	if (strings.length === 0) return null;
	const midi = frequencyToMidi(frequency, a4);
	return strings.reduce((best, s) => (Math.abs(s - midi) < Math.abs(best - midi) ? s : best));
}

export function analyze(frequency: number, a4: number, strings: number[], lockedString: number | null): Reading {
	const target = lockedString ?? nearestString(frequency, strings, a4) ?? Math.round(frequencyToMidi(frequency, a4));
	const targetFrequency = midiToFrequency(target, a4);
	return {
		frequency,
		target: noteInfo(target),
		targetFrequency,
		cents: 1200 * Math.log2(frequency / targetFrequency),
	};
}
