export const THEMES = ["auto", "light", "dark", "eink"] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = "player.theme";
const EINK_QUERY = "(update: slow), (monochrome)";

let current: Theme = "auto";
let einkMedia: MediaQueryList | null = null;

export function loadTheme(): Theme {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return THEMES.includes(stored as Theme) ? (stored as Theme) : "auto";
	} catch {
		return "auto";
	}
}

function isEinkDisplay(): boolean {
	return getEinkMedia()?.matches ?? false;
}

export function applyTheme(theme: Theme): void {
	current = theme;
	render();
	try {
		if (theme === "auto") localStorage.removeItem(STORAGE_KEY);
		else localStorage.setItem(STORAGE_KEY, theme);
	} catch {}
}

function getEinkMedia(): MediaQueryList | null {
	if (!einkMedia && typeof matchMedia === "function") {
		einkMedia = matchMedia(EINK_QUERY);
		einkMedia.addEventListener?.("change", render);
	}
	return einkMedia;
}

function render(): void {
	const resolved = current === "auto" && isEinkDisplay() ? "eink" : current;
	if (resolved === "auto") document.documentElement.removeAttribute("data-theme");
	else document.documentElement.setAttribute("data-theme", resolved);
}
