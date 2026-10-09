import { signal } from "@angular/core";

export const THEMES = ["auto", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = "portal.theme";
const BACKGROUNDS = { light: "#f4f5f7", dark: "#111317" };

function loadTheme(): Theme {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return THEMES.includes(stored as Theme) ? (stored as Theme) : "auto";
	} catch {
		return "auto";
	}
}

export const theme = signal<Theme>(loadTheme());

const originals = new Map<HTMLMetaElement, string>();

function render(value: Theme): void {
	const root = document.documentElement;
	if (value === "auto") root.removeAttribute("data-theme");
	else root.setAttribute("data-theme", value);
	for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
		if (!originals.has(meta)) originals.set(meta, meta.content);
		meta.content = value === "auto" ? originals.get(meta)! : BACKGROUNDS[value];
	}
}

export function applyTheme(value: Theme): void {
	theme.set(value);
	render(value);
	try {
		if (value === "auto") localStorage.removeItem(STORAGE_KEY);
		else localStorage.setItem(STORAGE_KEY, value);
	} catch {}
}

export function initTheme(): void {
	render(theme());
}
