export function detectPitch(
	samples: Float32Array,
	sampleRate: number,
	minFrequency: number,
	maxFrequency: number,
	threshold = 0.15,
): number | null {
	const tauMin = Math.max(2, Math.floor(sampleRate / maxFrequency));
	const tauMax = Math.min(Math.floor(samples.length / 2), Math.ceil(sampleRate / minFrequency));
	if (tauMax <= tauMin) return null;

	const offset = samples.length - 2 * tauMax;
	const window = tauMax;
	const difference = new Float32Array(tauMax + 1);

	for (let tau = 1; tau <= tauMax; tau++) {
		let sum = 0;
		for (let i = 0; i < window; i++) {
			const delta = samples[offset + i] - samples[offset + i + tau];
			sum += delta * delta;
		}
		difference[tau] = sum;
	}

	const normalized = new Float32Array(tauMax + 1);
	normalized[0] = 1;
	let runningSum = 0;
	for (let tau = 1; tau <= tauMax; tau++) {
		runningSum += difference[tau];
		normalized[tau] = runningSum === 0 ? 1 : (difference[tau] * tau) / runningSum;
	}

	let bestTau = -1;
	for (let tau = tauMin; tau < tauMax; tau++) {
		if (normalized[tau] < threshold) {
			while (tau + 1 < tauMax && normalized[tau + 1] < normalized[tau]) tau++;
			bestTau = tau;
			break;
		}
	}
	if (bestTau === -1) return null;

	const prev = normalized[bestTau - 1];
	const curr = normalized[bestTau];
	const next = normalized[bestTau + 1];
	const denominator = prev + next - 2 * curr;
	const refinedTau = denominator === 0 ? bestTau : bestTau + (prev - next) / (2 * denominator);

	return sampleRate / refinedTau;
}

export function rms(samples: Float32Array): number {
	let sum = 0;
	for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
	return Math.sqrt(sum / samples.length);
}
