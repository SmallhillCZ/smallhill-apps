import { detectPitch, rms } from "./pitch-detector";

function tone(frequency: number, sampleRate: number, length: number, harmonics = [1]): Float32Array {
	const out = new Float32Array(length);
	for (let i = 0; i < length; i++) {
		let value = 0;
		harmonics.forEach((amplitude, h) => {
			value += amplitude * Math.sin((2 * Math.PI * frequency * (h + 1) * i) / sampleRate);
		});
		out[i] = value * 0.5;
	}
	return out;
}

describe("detectPitch", () => {
	const sampleRate = 48000;

	for (const frequency of [41.2, 82.41, 110, 196, 440, 659.25, 1318.5]) {
		it(`detects ${frequency} Hz within 1 cent`, () => {
			const detected = detectPitch(tone(frequency, sampleRate, 4096), sampleRate, 30, 2800);
			expect(detected).not.toBeNull();
			expect(Math.abs(1200 * Math.log2(detected! / frequency))).toBeLessThan(1);
		});
	}

	it("finds the fundamental of a harmonically rich tone", () => {
		const detected = detectPitch(tone(110, sampleRate, 4096, [0.6, 1, 0.8, 0.5]), sampleRate, 60, 1400);
		expect(Math.abs(1200 * Math.log2(detected! / 110))).toBeLessThan(2);
	});

	it("returns null for noise", () => {
		const noise = new Float32Array(4096).map(() => Math.random() * 2 - 1);
		expect(detectPitch(noise, sampleRate, 60, 1400)).toBeNull();
	});

	it("computes rms", () => {
		expect(rms(new Float32Array([1, -1, 1, -1]))).toBe(1);
	});
});
