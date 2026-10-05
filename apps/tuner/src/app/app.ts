import { DecimalPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, signal } from "@angular/core";
import { Gauge } from "./gauge/gauge";
import { T } from "./i18n";
import { applyTheme, loadTheme, Theme, THEMES } from "./theme";
import { analyze, InstrumentId, INSTRUMENTS, noteInfo } from "./tuning/notes";
import { TunerService } from "./tuning/tuner.service";

const STORAGE_KEY = "tuner.settings";
const IN_TUNE_CENTS = 5;

interface Settings {
	instrument: InstrumentId;
	a4: number;
}

function loadSettings(): Settings {
	const defaults: Settings = { instrument: "guitar", a4: 440 };
	try {
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Settings>;
		return {
			instrument: INSTRUMENTS.some((i) => i.id === stored.instrument) ? stored.instrument! : defaults.instrument,
			a4: typeof stored.a4 === "number" && stored.a4 >= 415 && stored.a4 <= 466 ? stored.a4 : defaults.a4,
		};
	} catch {
		return defaults;
	}
}

@Component({
	selector: "app-root",
	imports: [Gauge, DecimalPipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./app.html",
	styleUrl: "./app.scss",
})
export class App implements OnDestroy {
	protected readonly tuner = inject(TunerService);
	protected readonly t = T;
	protected readonly instruments = INSTRUMENTS;
	protected readonly themes = THEMES;
	protected readonly theme = signal<Theme>(loadTheme());

	private readonly initial = loadSettings();
	protected readonly instrumentId = signal<InstrumentId>(this.initial.instrument);
	protected readonly a4 = signal(this.initial.a4);
	protected readonly lockedString = signal<number | null>(null);

	protected readonly instrument = computed(() => INSTRUMENTS.find((i) => i.id === this.instrumentId())!);
	protected readonly strings = computed(() => this.instrument().strings.map((midi) => noteInfo(midi)));

	protected readonly reading = computed(() => {
		const frequency = this.tuner.frequency();
		return frequency === null
			? null
			: analyze(frequency, this.a4(), this.instrument().strings, this.lockedString());
	});

	protected readonly hint = computed(() => {
		const reading = this.reading();
		if (!reading) return this.instrument().strings.length ? T.playString : T.playNote;
		if (Math.abs(reading.cents) <= IN_TUNE_CENTS) return T.inTune;
		return reading.cents < 0 ? T.tuneUp : T.tuneDown;
	});

	protected readonly inTune = computed(() => {
		const reading = this.reading();
		return reading !== null && Math.abs(reading.cents) <= IN_TUNE_CENTS;
	});

	protected readonly displayCents = computed(() => {
		const reading = this.reading();
		return reading === null ? null : Math.max(-99, Math.min(99, Math.round(reading.cents)));
	});

	constructor() {
		effect(() => applyTheme(this.theme()));
		effect(() => {
			const { minFrequency, maxFrequency } = this.instrument();
			this.tuner.setRange(minFrequency, maxFrequency);
		});
		effect(() => {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify({ instrument: this.instrumentId(), a4: this.a4() }));
			} catch {}
		});
	}

	protected selectInstrument(id: InstrumentId): void {
		this.instrumentId.set(id);
		this.lockedString.set(null);
	}

	protected toggleString(midi: number): void {
		this.lockedString.update((current) => (current === midi ? null : midi));
	}

	protected setTheme(theme: Theme): void {
		if (THEMES.includes(theme)) this.theme.set(theme);
	}

	protected changeA4(delta: number): void {
		this.a4.update((value) => Math.max(415, Math.min(466, value + delta)));
	}

	ngOnDestroy(): void {
		this.tuner.stop();
	}
}
