import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/app.config";
import { App } from "./app/app";
import { LANG } from "./app/i18n";
import { applyTheme, loadTheme } from "./app/theme";

document.documentElement.lang = LANG;
applyTheme(loadTheme());

if (matchMedia("(display-mode: standalone)").matches) {
	try {
		localStorage.setItem("smallhill.installed.tuner", new Date().toISOString());
	} catch {}
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
