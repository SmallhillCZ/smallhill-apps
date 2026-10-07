export const THEMES = ["auto", "light", "dark", "eink"] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = "player.theme";
const EINK_QUERY = "(update: slow), (monochrome)";
const OVERLAY_QUERY = "(display-mode: window-controls-overlay)";
const BRAND_COLOR = "#7048e8";

let current: Theme = "auto";
let einkMedia: MediaQueryList | null = null;
let watching = false;

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
	syncTitleBar();
}

function syncTitleBar(): void {
	if (typeof matchMedia !== "function") return;
	if (!watching) {
		watching = true;
		matchMedia(OVERLAY_QUERY).addEventListener?.("change", syncTitleBar);
		matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", syncTitleBar);
	}
	const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
	if (!meta) return;
	meta.content = matchMedia(OVERLAY_QUERY).matches ? getComputedStyle(document.body).backgroundColor : BRAND_COLOR;
}
