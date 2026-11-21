import { Injectable, computed, signal } from "@angular/core";

export type Lang = "en" | "cs";
export const LANGS: Lang[] = ["en", "cs"];

const en = {
	appName: "Memes",
	language: "Language",
	menu: "Menu",
	theme: "Theme",
	themes: { auto: "Auto", light: "Light", dark: "Dark" },
	backup: "Back up library",
	restore: "Restore from backup",

	search: "Search titles and tags",
	clearSearch: "Clear search",
	add: "Add",
	addFiles: "Choose files",
	pasteImage: "Paste",
	untagged: "Untagged",
	count: (n: number) => (n === 1 ? "1 meme" : `${n} memes`),
	nothingFound: "No meme matches your search.",

	emptyTitle: "Your own meme library",
	emptyText:
		"Save the memes you like, tag them so you find them in a second and send them to any chat app. Everything stays on this device.",
	emptyShare: "Share a picture, GIF or video from another app to Memes",
	emptyShareHint: "after installing the app on your phone.",
	emptyPick: "Choose files from your device.",
	emptyPaste: "Paste a copied image with Ctrl+V or drop files here.",

	titleLabel: "Title",
	titlePlaceholder: "What's in it?",
	tagsLabel: "Tags",
	tagsPlaceholder: "Add a tag and press Enter",
	removeTag: (tag: string) => `Remove tag ${tag}`,
	share: "Share",
	quickShare: (title: string) => `Share ${title}`,
	copy: "Copy",
	download: "Save",
	delete: "Delete",
	close: "Close",
	confirmDelete: "Delete this meme?",
	used: (n: number) => (n === 1 ? "Shared once" : `Shared ${n} times`),
	neverUsed: "Not shared yet",

	added: (n: number) => (n === 1 ? "Meme added." : `${n} memes added.`),
	notMedia: "Only pictures, GIFs and videos can be saved.",
	shareFailed: "Nothing to save came with the share.",
	copied: "Copied. Paste it into your chat.",
	copiedStill: "Copied as a still image. Use Share to send the animation.",
	copyFailed: "This device can't copy pictures. Use Share or Save.",
	copyVideo: "Videos can't be copied. Use Share or Save.",
	shareUnsupported: "Sharing files isn't supported here, so the meme was saved to your downloads.",
	deleted: "Meme deleted.",
	undo: "Undo",
	pasteEmpty: "No picture in the clipboard.",
	restored: (n: number) => (n === 1 ? "1 meme restored." : `${n} memes restored.`),
	restoreFailed: "This file is not a Memes backup.",
	storageFailed: "The meme could not be saved. The device may be out of space.",
};

export type Texts = typeof en;

const cs: Texts = {
	appName: "Memy",
	language: "Jazyk",
	menu: "Nabídka",
	theme: "Vzhled",
	themes: { auto: "Automaticky", light: "Světlý", dark: "Tmavý" },
	backup: "Zálohovat knihovnu",
	restore: "Obnovit ze zálohy",

	search: "Hledat v názvech a štítcích",
	clearSearch: "Smazat hledání",
	add: "Přidat",
	addFiles: "Vybrat soubory",
	pasteImage: "Vložit",
	untagged: "Bez štítku",
	count: (n: number) => (n === 1 ? "1 mem" : `${n} ${czech(n, "mem", "memy", "memů")}`),
	nothingFound: "Hledání neodpovídá žádný mem.",

	emptyTitle: "Vaše vlastní knihovna memů",
	emptyText:
		"Ukládejte si memy, které se vám líbí, označte je štítky, ať je najdete za vteřinu, a posílejte je do jakékoli chatovací aplikace. Všechno zůstává v tomto zařízení.",
	emptyShare: "Sdílejte obrázek, GIF nebo video z jiné aplikace do Memů",
	emptyShareHint: "po instalaci aplikace do telefonu.",
	emptyPick: "Vyberte soubory ze zařízení.",
	emptyPaste: "Vložte zkopírovaný obrázek pomocí Ctrl+V nebo sem přetáhněte soubory.",

	titleLabel: "Název",
	titlePlaceholder: "Co na něm je?",
	tagsLabel: "Štítky",
	tagsPlaceholder: "Napište štítek a stiskněte Enter",
	removeTag: (tag: string) => `Odebrat štítek ${tag}`,
	share: "Sdílet",
	quickShare: (title: string) => `Sdílet ${title}`,
	copy: "Kopírovat",
	download: "Uložit",
	delete: "Smazat",
	close: "Zavřít",
	confirmDelete: "Smazat tento mem?",
	used: (n: number) => (n === 1 ? "Sdíleno jednou" : `Sdíleno ${n}×`),
	neverUsed: "Zatím nesdíleno",

	added: (n: number) => (n === 1 ? "Mem přidán." : `Přidáno ${n} ${czech(n, "mem", "memy", "memů")}.`),
	notMedia: "Uložit jde jen obrázky, GIFy a videa.",
	shareFailed: "Se sdílením nepřišlo nic, co by šlo uložit.",
	copied: "Zkopírováno. Vložte ho do chatu.",
	copiedStill: "Zkopírováno jako statický obrázek. Animaci pošlete přes Sdílet.",
	copyFailed: "Toto zařízení neumí kopírovat obrázky. Použijte Sdílet nebo Uložit.",
	copyVideo: "Videa nejde kopírovat. Použijte Sdílet nebo Uložit.",
	shareUnsupported: "Sdílení souborů tu není podporované, mem se proto uložil do stažených souborů.",
	deleted: "Mem smazán.",
	undo: "Zpět",
	pasteEmpty: "Ve schránce není obrázek.",
	restored: (n: number) => (n === 1 ? "Obnoven 1 mem." : `Obnoveno ${n} ${czech(n, "mem", "memy", "memů")}.`),
	restoreFailed: "Tento soubor není záloha Memů.",
	storageFailed: "Mem se nepodařilo uložit. Zařízení možná nemá dost místa.",
};

const TEXTS: Record<Lang, Texts> = { en, cs };
const STORAGE_KEY = "memes.lang";

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
