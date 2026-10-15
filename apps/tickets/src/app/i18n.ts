import { Injectable, computed, signal } from "@angular/core";

export type Lang = "en" | "cs";
export const LANGS: Lang[] = ["en", "cs"];

const en = {
	appName: "Tickets",
	language: "Language",
	menu: "Menu",
	theme: "Theme",
	themes: { auto: "Auto", light: "Light", dark: "Dark", eink: "E-ink" },
	logout: "Sign out",

	loginTitle: "Your GoOut tickets",
	loginText: "Sign in with your GoOut e-mail and password to see the tickets you bought.",
	email: "E-mail",
	password: "Password",
	signIn: "Sign in",
	signingIn: "Signing in…",
	privacy:
		"Your password goes straight to GoOut and is never saved. Only the GoOut sign-in stays on this device, so you don't have to sign in again.",
	socialHint: "Signed up to GoOut with Google or Facebook? Set a password in GoOut first (Forgot password).",
	badCredentials: "Wrong e-mail or password.",
	gooutDown: "GoOut is not responding. Try again later.",
	offline: "You are offline.",

	upcoming: "Your tickets",
	today: "Today",
	noTickets: "No upcoming tickets.",
	refresh: "Refresh",
	refreshing: "Refreshing…",
	cachedNote: (when: string) => `Offline copy from ${when}.`,
	ticketCount: (n: number) => (n === 1 ? "1 ticket" : `${n} tickets`),

	back: "Back",
	loadingTicket: "Loading the ticket…",
	ticketPages: (n: number) => (n === 1 ? "" : `${n} pages`),
	emailed:
		"GoOut did not show this ticket here and sent it to your e-mail instead. Open it from the e-mail, or try again later.",
	ticketFailed: "The ticket could not be loaded.",
	openInGoout: "Open in GoOut",
	savedOffline: "Saved on this device, works without internet.",
	sessionExpired: "Your GoOut sign-in expired. Sign in again.",
};

export type Texts = typeof en;

const cs: Texts = {
	appName: "Vstupenky",
	language: "Jazyk",
	menu: "Nabídka",
	theme: "Vzhled",
	themes: { auto: "Automaticky", light: "Světlý", dark: "Tmavý", eink: "E-ink" },
	logout: "Odhlásit",

	loginTitle: "Vaše vstupenky z GoOut",
	loginText: "Přihlaste se e-mailem a heslem ke GoOut a uvidíte vstupenky, které jste koupili.",
	email: "E-mail",
	password: "Heslo",
	signIn: "Přihlásit",
	signingIn: "Přihlašuji…",
	privacy:
		"Heslo jde rovnou do GoOut a nikde se neukládá. Na tomto zařízení zůstane jen přihlášení do GoOut, abyste se nemuseli přihlašovat znovu.",
	socialHint:
		"Registrovali jste se do GoOut přes Google nebo Facebook? Nastavte si v GoOut nejdřív heslo (Zapomenuté heslo).",
	badCredentials: "Špatný e-mail nebo heslo.",
	gooutDown: "GoOut neodpovídá. Zkuste to později.",
	offline: "Jste offline.",

	upcoming: "Vaše vstupenky",
	today: "Dnes",
	noTickets: "Žádné nadcházející vstupenky.",
	refresh: "Obnovit",
	refreshing: "Obnovuji…",
	cachedNote: (when: string) => `Uložená kopie z ${when}.`,
	ticketCount: (n: number) => (n === 1 ? "1 vstupenka" : `${n} ${czech(n, "vstupenka", "vstupenky", "vstupenek")}`),

	back: "Zpět",
	loadingTicket: "Načítám vstupenku…",
	ticketPages: (n: number) => (n === 1 ? "" : `${n} ${czech(n, "strana", "strany", "stran")}`),
	emailed:
		"GoOut tady vstupenku neukázal a poslal ji místo toho na váš e-mail. Otevřete ji z e-mailu, nebo to zkuste později.",
	ticketFailed: "Vstupenku se nepodařilo načíst.",
	openInGoout: "Otevřít v GoOut",
	savedOffline: "Uloženo v zařízení, funguje i bez internetu.",
	sessionExpired: "Přihlášení do GoOut vypršelo. Přihlaste se znovu.",
};

const TEXTS: Record<Lang, Texts> = { en, cs };
const STORAGE_KEY = "tickets.lang";

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
