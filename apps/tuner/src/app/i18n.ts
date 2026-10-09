import { computed, signal } from "@angular/core";

export type Lang = "en" | "cs";

const en = {
	start: "Start tuning",
	stop: "Stop",
	starting: "Waiting for microphone…",
	playString: "Play a string",
	playNote: "Play a note",
	inTune: "In tune",
	tuneUp: "Tune up",
	tuneDown: "Tune down",
	denied: "Microphone access was denied. Allow it in your browser settings and try again.",
	error: "The microphone could not be started.",
	reference: "Reference A4",
	auto: "Auto",
	instruments: { guitar: "Guitar", bass: "Bass", violin: "Violin", chromatic: "Chromatic" },
	theme: "Theme",
	themes: { auto: "Auto", light: "Light", dark: "Dark", eink: "E-ink" },
	language: "Language",
	menu: "Menu",
};

const cs: typeof en = {
	start: "Začít ladit",
	stop: "Zastavit",
	starting: "Čekám na mikrofon…",
	playString: "Zahrajte strunu",
	playNote: "Zahrajte tón",
	inTune: "Naladěno",
	tuneUp: "Přitáhnout",
	tuneDown: "Povolit",
	denied: "Přístup k mikrofonu byl zamítnut. Povolte ho v nastavení prohlížeče a zkuste to znovu.",
	error: "Mikrofon se nepodařilo spustit.",
	reference: "Ladění A4",
	auto: "Auto",
	instruments: { guitar: "Kytara", bass: "Baskytara", violin: "Housle", chromatic: "Chromatické" },
	theme: "Vzhled",
	themes: { auto: "Automatický", light: "Světlý", dark: "Tmavý", eink: "E-ink" },
	language: "Jazyk",
	menu: "Nabídka",
};

const STORAGE_KEY = "tuner.lang";
export const LANGS: Lang[] = ["en", "cs"];
const TEXTS: Record<Lang, typeof en> = { en, cs };

export function detectLang(languages: readonly string[]): Lang {
	for (const language of languages) {
		const code = language.toLowerCase().split("-")[0];
		if (code === "cs" || code === "sk") return "cs";
		if (code === "en") return "en";
	}
	return "en";
}

function initialLang(): Lang {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (LANGS.includes(stored as Lang)) return stored as Lang;
	} catch {}
	if (typeof navigator === "undefined") return "en";
	return detectLang(navigator.languages?.length ? navigator.languages : [navigator.language ?? ""]);
}

export const lang = signal<Lang>(initialLang());
export const T = computed(() => TEXTS[lang()]);

export function setLang(value: Lang): void {
	lang.set(value);
	try {
		localStorage.setItem(STORAGE_KEY, value);
	} catch {}
}
