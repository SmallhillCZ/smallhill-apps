import { Injectable, signal } from "@angular/core";
import { detectPitch, rms } from "./pitch-detector";

export type TunerStatus = "idle" | "starting" | "listening" | "denied" | "error";

const SILENCE_RMS = 0.008;
const SILENCE_HOLD_MS = 1500;
const HISTORY_SIZE = 5;

@Injectable({ providedIn: "root" })
export class TunerService {
	readonly status = signal<TunerStatus>("idle");
	readonly frequency = signal<number | null>(null);
	readonly level = signal(0);

	private context?: AudioContext;
	private stream?: MediaStream;
	private analyser?: AnalyserNode;
	private buffer?: Float32Array<ArrayBuffer>;
	private frame?: number;
	private wakeLock?: WakeLockSentinel;
	private history: number[] = [];
	private lastSoundAt = 0;
	private range = { min: 60, max: 1400 };

	setRange(min: number, max: number): void {
		this.range = { min, max };
		this.history = [];
	}

	async start(): Promise<void> {
		if (this.status() === "listening" || this.status() === "starting") return;
		this.status.set("starting");
		try {
			this.stream = await navigator.mediaDevices.getUserMedia({
				audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
			});
		} catch (error) {
			this.status.set(error instanceof DOMException && error.name === "NotAllowedError" ? "denied" : "error");
			return;
		}

		this.context = new AudioContext();
		await this.context.resume();
		this.analyser = this.context.createAnalyser();
		this.analyser.fftSize = this.context.sampleRate > 48000 ? 8192 : 4096;
		this.buffer = new Float32Array(this.analyser.fftSize);
		this.context.createMediaStreamSource(this.stream).connect(this.analyser);

		this.history = [];
		this.status.set("listening");
		this.requestWakeLock();
		this.loop();
	}

	stop(): void {
		if (this.frame !== undefined) cancelAnimationFrame(this.frame);
		this.frame = undefined;
		this.stream?.getTracks().forEach((track) => track.stop());
		this.context?.close();
		this.wakeLock?.release().catch(() => undefined);
		this.stream = this.context = this.analyser = this.buffer = this.wakeLock = undefined;
		this.frequency.set(null);
		this.level.set(0);
		this.status.set("idle");
	}

	private loop = (): void => {
		this.frame = requestAnimationFrame(this.loop);
		if (!this.analyser || !this.buffer || !this.context) return;

		this.analyser.getFloatTimeDomainData(this.buffer);
		const volume = rms(this.buffer);
		this.level.set(Math.min(1, volume * 10));
		const now = performance.now();

		const detected =
			volume > SILENCE_RMS
				? detectPitch(this.buffer, this.context.sampleRate, this.range.min, this.range.max)
				: null;

		if (detected === null) {
			if (now - this.lastSoundAt > SILENCE_HOLD_MS) {
				this.history = [];
				this.frequency.set(null);
			}
			return;
		}

		this.lastSoundAt = now;
		const current = this.frequency();
		if (current !== null && Math.abs(12 * Math.log2(detected / current)) > 1) this.history = [];
		this.history.push(detected);
		if (this.history.length > HISTORY_SIZE) this.history.shift();
		const sorted = [...this.history].sort((a, b) => a - b);
		this.frequency.set(sorted[Math.floor(sorted.length / 2)]);
	};

	private async requestWakeLock(): Promise<void> {
		try {
			this.wakeLock = await navigator.wakeLock?.request("screen");
		} catch {
			this.wakeLock = undefined;
		}
	}
}
