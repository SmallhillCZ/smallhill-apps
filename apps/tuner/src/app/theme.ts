export const THEMES = ["auto", "light", "dark", "eink"] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = "tuner.theme";

export function loadTheme(): Theme {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return THEMES.includes(stored as Theme) ? (stored as Theme) : "auto";
	} catch {
		return "auto";
	}
}

export function applyTheme(theme: Theme): void {
	if (theme === "auto") document.documentElement.removeAttribute("data-theme");
	else document.documentElement.setAttribute("data-theme", theme);
	try {
		localStorage.setItem(STORAGE_KEY, theme);
	} catch {}
}
