import { Injectable, computed, signal } from "@angular/core";

export type Lang = "en" | "cs";
export const LANGS: Lang[] = ["en", "cs"];

const en = {
	appName: "Places",
	language: "Language",
	menu: "Menu",
	theme: "Theme",
	themes: { auto: "Auto", light: "Light", dark: "Dark", eink: "E-ink" },

	lists: "Your lists",
	addTitle: "Add a Google Maps list",
	addHint: "In Google Maps open a list, tap Share, choose Send link to view and paste the link here.",
	linkPlaceholder: "https://maps.app.goo.gl/…",
	add: "Add",
	adding: "Adding…",
	empty: "No lists yet. Add one below and its places appear on the map.",
	places: (n: number) => (n === 1 ? "1 place" : `${n} places`),
	show: "Show on the map",
	color: "Change colour",
	expand: "Show places",
	collapse: "Hide places",
	remove: "Remove",
	refresh: "Refresh",
	refreshAll: "Refresh lists",
	showPanel: "Show lists",
	hidePanel: "Hide lists",
	noActive: "No list shown",
	addList: "Add a list",
	fit: "Show all places",
	alreadyAdded: "This list is already added.",
	badUrl: "This is not a Google Maps list link.",
	notFound: "The list was not found. Make sure it is shared with Send link to view.",
	googleDown: "Google Maps is not responding. Try again later.",
	offline: "You are offline.",
	cached: (when: string) => `Saved copy from ${when}.`,
	untitled: "Untitled list",
	mapStyle: "Map",
	mapsets: { basic: "Basic", outdoor: "Outdoor", aerial: "Aerial", winter: "Winter" },
	openGoogle: "Google Maps",
	openMapy: "Mapy.com",
	locate: "Show my location",
	zoom: "Zoom: drag up or down",
	photoClose: "Close photo",
	photoPrev: "Previous photo",
	photoNext: "Next photo",
	locateFailed: "Your location is not available.",
	share: "Share lists",
	shareTitle: "My places",
	linkCopied: "Link copied. Anyone who opens it sees these lists.",
	importing: "Loading shared lists…",
	sharedTitle: (n: number, who: string | null): string =>
		`${who ?? "Someone"} shared ${n === 1 ? "a list" : "lists"} with you`,
	sharedBy: (who: string) => `by ${who}`,
	sharedQuestion: (n: number): string =>
		n === 1 ? "Do you want to add it to your lists?" : "Do you want to add them to your lists?",
	sharedAdd: "Add to my lists",
	sharedView: "Just look",
	sharedBanner: "Shared with you, not saved",
	sharedDismiss: "Close",
	importFailed: (n: number) =>
		n === 1 ? "1 shared list could not be loaded." : `${n} shared lists could not be loaded.`,
};

export type Texts = typeof en;

const cs: Texts = {
	appName: "Místa",
	language: "Jazyk",
	menu: "Nabídka",
	theme: "Vzhled",
	themes: { auto: "Automaticky", light: "Světlý", dark: "Tmavý", eink: "E-ink" },

	lists: "Vaše seznamy",
	addTitle: "Přidat seznam z Map Google",
	addHint:
		"V Mapách Google otevřete seznam, klepněte na Sdílet, zvolte Odeslat odkaz k zobrazení a odkaz vložte sem.",
	linkPlaceholder: "https://maps.app.goo.gl/…",
	add: "Přidat",
	adding: "Přidávám…",
	empty: "Zatím tu nejsou žádné seznamy. Přidejte seznam níže a jeho místa se objeví na mapě.",
	places: (n: number) => (n === 1 ? "1 místo" : `${n} ${czech(n, "místo", "místa", "míst")}`),
	show: "Zobrazit na mapě",
	color: "Změnit barvu",
	expand: "Zobrazit místa",
	collapse: "Skrýt místa",
	remove: "Odebrat",
	refresh: "Obnovit",
	refreshAll: "Obnovit seznamy",
	showPanel: "Zobrazit seznamy",
	hidePanel: "Skrýt seznamy",
	noActive: "Žádný seznam není zobrazen",
	addList: "Přidat seznam",
	fit: "Zobrazit všechna místa",
	alreadyAdded: "Tento seznam už je přidaný.",
	badUrl: "Tohle není odkaz na seznam v Mapách Google.",
	notFound: "Seznam se nenašel. Zkontrolujte, že je sdílený přes Odeslat odkaz k zobrazení.",
	googleDown: "Mapy Google neodpovídají. Zkuste to později.",
	offline: "Jste offline.",
	cached: (when: string) => `Uložená kopie z ${when}.`,
	untitled: "Seznam bez názvu",
	mapStyle: "Mapa",
	mapsets: { basic: "Základní", outdoor: "Turistická", aerial: "Letecká", winter: "Zimní" },
	openGoogle: "Mapy Google",
	openMapy: "Mapy.com",
	locate: "Zobrazit moji polohu",
	zoom: "Přiblížení: táhněte nahoru nebo dolů",
	photoClose: "Zavřít fotku",
	photoPrev: "Předchozí fotka",
	photoNext: "Další fotka",
	locateFailed: "Vaše poloha není dostupná.",
	share: "Sdílet seznamy",
	shareTitle: "Moje místa",
	linkCopied: "Odkaz zkopírován. Kdo ho otevře, uvidí tyto seznamy.",
	importing: "Načítám sdílené seznamy…",
	sharedTitle: (n: number, who: string | null): string =>
		`${who ?? "Někdo"} s vámi sdílí ${n === 1 ? "seznam" : "seznamy"}`,
	sharedBy: (who: string) => `od ${who}`,
	sharedQuestion: (n: number): string =>
		n === 1 ? "Chcete si ho přidat do svých seznamů?" : "Chcete si je přidat do svých seznamů?",
	sharedAdd: "Přidat do mých seznamů",
	sharedView: "Jen se podívat",
	sharedBanner: "Sdíleno s vámi, neuloženo",
	sharedDismiss: "Zavřít",
	importFailed: (n: number) =>
		n === 1
			? "1 sdílený seznam se nepodařilo načíst."
			: `${n} ${czech(n, "sdílený seznam", "sdílené seznamy", "sdílených seznamů")} se nepodařilo načíst.`,
};

const TEXTS: Record<Lang, Texts> = { en, cs };
const STORAGE_KEY = "places.lang";

function czech(n: number, one: string, few: string, many: string) {
	const rule = new Intl.PluralRules("cs").select(n);
	return rule === "one" ? one : rule === "few" ? few : many;
}

export function detectLang(languages: readonly string[]): Lang {
	for (const l of languages) {
		const base = l.toLowerCase().split("-")[0];
		if (base === "sk") return "cs";
		if ((LANGS as string[]).includes(base)) return base as Lang;
	}
	return "en";
}

function browserLanguages(): readonly string[] {
	if (typeof navigator === "undefined") return [];
	return navigator.languages?.length ? navigator.languages : [navigator.language];
}

function storedLang(): Lang | null {
	try {
		const v = localStorage.getItem(STORAGE_KEY);
		return v && (LANGS as string[]).includes(v) ? (v as Lang) : null;
	} catch {
		return null;
	}
}

@Injectable({ providedIn: "root" })
export class I18n {
	private readonly chosen = signal<Lang | null>(storedLang());
	readonly lang = computed(() => this.chosen() ?? detectLang(browserLanguages()));
	readonly t = computed(() => TEXTS[this.lang()]);
	readonly locale = computed(() => {
		const lang = this.lang();
		const match = browserLanguages().find((l) => l.toLowerCase().split("-")[0] === lang);
		try {
			return match && Intl.DateTimeFormat.supportedLocalesOf(match).length ? match : lang;
		} catch {
			return lang;
		}
	});

	constructor() {
		this.apply();
	}

	setLang(lang: Lang) {
		this.chosen.set(lang);
		this.apply();
		try {
			localStorage.setItem(STORAGE_KEY, lang);
		} catch {}
	}

	private apply() {
		if (typeof document !== "undefined") document.documentElement.lang = this.lang();
	}
}
