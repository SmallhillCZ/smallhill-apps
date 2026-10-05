export type Lang = "en" | "cs";
export type Text = Record<Lang, string>;

const en = {
	title: "Smallhill Apps",
	subtitle: "Simple apps that do one thing well. Free, no ads, no tracking.",
	install: "Install",
	installed: "Installed",
	installing: "Installing…",
	open: "Open in browser",
	soon: "Coming soon",
	close: "Close",
	screenshots: "Screenshots",
	noScreenshots: "Screenshots coming soon.",
	about: "About",
	details: "Details of",
	features: ["Free", "No ads", "No tracking"],
	installHelp:
		"Your browser can't install apps from this page. Open the app and install it from the browser menu: Install app in Chrome or Edge, Share → Add to Home Screen in Safari.",
	footer: "Made with care by Smallhill. No ads, no tracking, no accounts unless an app truly needs one.",
};

const cs: typeof en = {
	title: "Smallhill Apps",
	subtitle: "Jednoduché aplikace, které dělají jednu věc dobře. Zdarma, bez reklam a bez sledování.",
	install: "Instalovat",
	installed: "Nainstalováno",
	installing: "Instaluji…",
	open: "Otevřít v prohlížeči",
	soon: "Již brzy",
	close: "Zavřít",
	screenshots: "Snímky obrazovky",
	noScreenshots: "Snímky obrazovky připravujeme.",
	about: "O aplikaci",
	details: "Podrobnosti o",
	features: ["Zdarma", "Bez reklam", "Bez sledování"],
	installHelp:
		"Váš prohlížeč neumí instalovat aplikace z této stránky. Otevřete aplikaci a nainstalujte ji z nabídky prohlížeče: Instalovat aplikaci v Chrome nebo Edge, Sdílet → Přidat na plochu v Safari.",
	footer: "S péčí vytváří Smallhill. Bez reklam, bez sledování a bez účtů, pokud je aplikace opravdu nepotřebuje.",
};

export const LANG: Lang =
	typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("cs") ? "cs" : "en";
export const T = LANG === "cs" ? cs : en;

export function tr(text: Text): string {
	return text[LANG];
}
