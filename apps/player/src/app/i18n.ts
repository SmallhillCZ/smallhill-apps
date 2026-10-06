import { computed, signal } from "@angular/core";

export type Lang = "en" | "cs";

const en = {
	title: "Player",
	heading: "Your music library",
	intro: "Add your OneDrive accounts and music folders on this device. Each one shows up here as a top-level folder.",
	loading: "Loading…",
	unconfigured: "The connection to OneDrive is not set up yet.",
	authError: "Signing in to Microsoft failed. Reload the page and try again.",
	folderError: "The folder could not be loaded.",
	retry: "Try again",
	empty: "No folders or audio files here.",
	items: (count: number) => `${count} ${count === 1 ? "item" : "items"}`,
	tracks: (count: number) => `${count} ${count === 1 ? "track" : "tracks"}`,
	library: "Library",
	addOneDrive: "Add OneDrive",
	addFolder: "Add folder",
	deviceFolder: "Folder on this device",
	signInAgain: "Sign in again",
	tapToAllow: "Tap to allow access",
	chooseAgain: "Choose the folder again",
	allow: "Allow access",
	remove: "Remove",
	rename: "Rename",
	removeConfirm: (name: string) => `Remove “${name}” from the library? Your files stay where they are.`,
	name: "Name",
	account: "Account",
	change: "Change",
	done: "Done",
	sessionOnly: "This browser can't remember folders, so you'll choose them again next time.",
	settings: "Settings",
	topFolder: "Top folder",
	wholeDrive: "Everything",
	chooseTop: (name: string) => `Open the folder with your music in “${name}” and use it as the top folder.`,
	useFolder: "Use this folder",
	cancel: "Cancel",
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
	openFolder: "Open the folder of this track",
	queue: "Queue",
	addToQueue: "Add to queue",
	addedToQueue: (name: string) => `Added to queue: ${name}`,
	noTracks: (name: string) => `No tracks in ${name}`,
	clearQueue: "Clear upcoming",
	removeFromQueue: "Remove from queue",
	privacy:
		"Music plays straight from OneDrive or from your device. The app only reads your files and nothing passes through our servers.",
	theme: "Theme",
	themes: { auto: "Auto theme", light: "Light", dark: "Dark", eink: "E-ink" },
	language: "Language",
};

const cs: typeof en = {
	title: "Přehrávač",
	heading: "Vaše hudební knihovna",
	intro: "Přidejte své účty OneDrive a složky s hudbou v tomto zařízení. Každý se tu zobrazí jako samostatná složka.",
	loading: "Načítám…",
	unconfigured: "Připojení k OneDrivu zatím není nastavené.",
	authError: "Přihlášení k Microsoftu selhalo. Obnovte stránku a zkuste to znovu.",
	folderError: "Složku se nepodařilo načíst.",
	retry: "Zkusit znovu",
	empty: "Nejsou tu žádné složky ani zvukové soubory.",
	items: (count: number) => `${count} ${count === 1 ? "položka" : count >= 2 && count <= 4 ? "položky" : "položek"}`,
	tracks: (count: number) => `${count} ${count === 1 ? "skladba" : count >= 2 && count <= 4 ? "skladby" : "skladeb"}`,
	library: "Knihovna",
	addOneDrive: "Přidat OneDrive",
	addFolder: "Přidat složku",
	deviceFolder: "Složka v tomto zařízení",
	signInAgain: "Přihlaste se znovu",
	tapToAllow: "Klepněte pro povolení přístupu",
	chooseAgain: "Vyberte složku znovu",
	allow: "Povolit přístup",
	remove: "Odebrat",
	rename: "Přejmenovat",
	removeConfirm: (name: string) => `Odebrat „${name}“ z knihovny? Soubory zůstanou, kde jsou.`,
	name: "Název",
	account: "Účet",
	change: "Změnit",
	done: "Hotovo",
	sessionOnly: "Tento prohlížeč si složky nepamatuje, příště je vyberete znovu.",
	settings: "Nastavení",
	topFolder: "Hlavní složka",
	wholeDrive: "Vše",
	chooseTop: (name: string) => `Otevřete složku s hudbou v „${name}“ a použijte ji jako hlavní složku.`,
	useFolder: "Použít tuto složku",
	cancel: "Zrušit",
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
	openFolder: "Otevřít složku této skladby",
	queue: "Fronta",
	addToQueue: "Přidat do fronty",
	addedToQueue: (name: string) => `Přidáno do fronty: ${name}`,
	noTracks: (name: string) => `Ve složce ${name} nejsou skladby`,
	clearQueue: "Vymazat další",
	removeFromQueue: "Odebrat z fronty",
	privacy:
		"Hudba se přehrává přímo z OneDrivu nebo z vašeho zařízení. Aplikace soubory jen čte a nic neprochází našimi servery.",
	theme: "Vzhled",
	themes: { auto: "Automatický vzhled", light: "Světlý", dark: "Tmavý", eink: "E-ink" },
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
