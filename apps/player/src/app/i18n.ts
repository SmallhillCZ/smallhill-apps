import { computed, signal } from "@angular/core";

export type Lang = "en" | "cs";

const en = {
	title: "Player",
	heading: "Your music from OneDrive",
	intro: "Sign in with your Microsoft account, browse your OneDrive folders and play MP3s and other audio files.",
	signIn: "Sign in with Microsoft",
	signOut: "Sign out",
	loading: "Loading…",
	unconfigured: "The connection to OneDrive is not set up yet. Please try again later.",
	authError: "Signing in to Microsoft failed. Reload the page and try again.",
	folderError: "The folder could not be loaded.",
	retry: "Try again",
	empty: "No folders or audio files here.",
	items: (count: number) => `${count} ${count === 1 ? "item" : "items"}`,
	tracks: (count: number) => `${count} ${count === 1 ? "track" : "tracks"}`,
	sources: "Music source",
	device: "This device",
	deviceHeading: "Music on this device",
	deviceIntro:
		"Choose a folder with your music on this computer or phone. Files are played straight from the device and never uploaded anywhere.",
	chooseFolder: "Choose folder",
	changeFolder: "Change folder",
	allowHeading: (name: string) => `Allow access to “${name}”`,
	allowIntro: "The browser asks again after a restart before the app can read your music folder.",
	allow: "Allow access",
	sessionOnly: "This browser can't remember the folder, so you'll choose it again next time.",
	setLibrary: "Set as music folder",
	isLibrary: "Music folder",
	goLibrary: "My music",
	playAll: "Play all",
	shuffleAll: "Shuffle",
	play: "Play",
	pause: "Pause",
	previous: "Previous",
	next: "Next",
	shuffle: "Shuffle",
	repeat: { off: "Repeat off", all: "Repeat all", one: "Repeat one" },
	seek: "Position",
	trackError: "This track could not be played.",
	close: "Close player",
	privacy:
		"Music plays straight from OneDrive or from your device. The app only reads your files and nothing passes through our servers.",
	theme: "Theme",
	themes: { auto: "Auto theme", light: "Light", dark: "Dark" },
	language: "Language",
};

const cs: typeof en = {
	title: "Přehrávač",
	heading: "Vaše hudba z OneDrivu",
	intro: "Přihlaste se účtem Microsoft, procházejte složky na OneDrivu a přehrávejte MP3 a další zvukové soubory.",
	signIn: "Přihlásit se přes Microsoft",
	signOut: "Odhlásit",
	loading: "Načítám…",
	unconfigured: "Připojení k OneDrivu zatím není nastavené. Zkuste to prosím později.",
	authError: "Přihlášení k Microsoftu selhalo. Obnovte stránku a zkuste to znovu.",
	folderError: "Složku se nepodařilo načíst.",
	retry: "Zkusit znovu",
	empty: "Nejsou tu žádné složky ani zvukové soubory.",
	items: (count: number) => `${count} ${count === 1 ? "položka" : count >= 2 && count <= 4 ? "položky" : "položek"}`,
	tracks: (count: number) => `${count} ${count === 1 ? "skladba" : count >= 2 && count <= 4 ? "skladby" : "skladeb"}`,
	sources: "Zdroj hudby",
	device: "Toto zařízení",
	deviceHeading: "Hudba v tomto zařízení",
	deviceIntro:
		"Vyberte složku s hudbou v tomto počítači nebo telefonu. Soubory se přehrávají přímo ze zařízení a nikam se nenahrávají.",
	chooseFolder: "Vybrat složku",
	changeFolder: "Změnit složku",
	allowHeading: (name: string) => `Povolit přístup ke složce „${name}“`,
	allowIntro: "Po restartu se prohlížeč znovu zeptá, než aplikace může číst vaši složku s hudbou.",
	allow: "Povolit přístup",
	sessionOnly: "Tento prohlížeč si složku nepamatuje, příště ji vyberete znovu.",
	setLibrary: "Nastavit jako složku s hudbou",
	isLibrary: "Složka s hudbou",
	goLibrary: "Moje hudba",
	playAll: "Přehrát vše",
	shuffleAll: "Náhodně",
	play: "Přehrát",
	pause: "Pozastavit",
	previous: "Předchozí",
	next: "Další",
	shuffle: "Náhodné pořadí",
	repeat: { off: "Neopakovat", all: "Opakovat vše", one: "Opakovat skladbu" },
	seek: "Pozice",
	trackError: "Tuto skladbu se nepodařilo přehrát.",
	close: "Zavřít přehrávač",
	privacy:
		"Hudba se přehrává přímo z OneDrivu nebo z vašeho zařízení. Aplikace soubory jen čte a nic neprochází našimi servery.",
	theme: "Vzhled",
	themes: { auto: "Automatický vzhled", light: "Světlý", dark: "Tmavý" },
	language: "Jazyk",
};

const STORAGE_KEY = "player.lang";
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
