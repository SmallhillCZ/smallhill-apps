import { computed, signal } from "@angular/core";

export type Lang = "en" | "cs";
export type Text = Record<Lang, string>;

const en = {
	title: "Smallhill Apps",
	subtitle: "Simple apps that do one thing well. Free, no ads, no tracking.",
	install: "Install",
	installed: "Installed",
	installing: "Installing…",
	open: "Open in browser",
	openApp: "Open",
	soon: "Coming soon",
	close: "Close",
	share: "Share",
	linkCopied: "Link copied to the clipboard.",
	screenshots: "Screenshots",
	noScreenshots: "Screenshots coming soon.",
	about: "About",
	details: "Details of",
	features: ["Free", "No ads", "No tracking"],
	installHelp:
		"Your browser can't install apps from this page. Open the app and install it from the browser menu: Install app in Chrome, Edge or Vivaldi, Share → Add to Home Screen in Safari.",
	language: "Language",
	footer: "Made with care by Smallhill. No ads, no tracking, no accounts unless an app truly needs one.",
};

const cs: typeof en = {
	title: "Smallhill Apps",
	subtitle: "Jednoduché aplikace, které dělají jednu věc dobře. Zdarma, bez reklam a bez sledování.",
	install: "Instalovat",
	installed: "Nainstalováno",
	installing: "Instaluji…",
	open: "Otevřít v prohlížeči",
	openApp: "Otevřít",
	soon: "Již brzy",
	close: "Zavřít",
	share: "Sdílet",
	linkCopied: "Odkaz je zkopírovaný do schránky.",
	screenshots: "Snímky obrazovky",
	noScreenshots: "Snímky obrazovky připravujeme.",
	about: "O aplikaci",
	details: "Podrobnosti o",
	features: ["Zdarma", "Bez reklam", "Bez sledování"],
	installHelp:
		"Váš prohlížeč neumí instalovat aplikace z této stránky. Otevřete aplikaci a nainstalujte ji z nabídky prohlížeče: Instalovat aplikaci v Chrome, Edge nebo Vivaldi, Sdílet → Přidat na plochu v Safari.",
	language: "Jazyk",
	footer: "S péčí vytváří Smallhill. Bez reklam, bez sledování a bez účtů, pokud je aplikace opravdu nepotřebuje.",
};

const STORAGE_KEY = "portal.lang";
const LANGS: Lang[] = ["en", "cs"];
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

export function tr(text: Text): string {
	return text[lang()];
}
