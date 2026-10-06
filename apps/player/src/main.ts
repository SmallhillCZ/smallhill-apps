import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/app.config";
import { App } from "./app/app";
import { lang } from "./app/i18n";
import { applyTheme, loadTheme } from "./app/theme";

document.documentElement.lang = lang();
applyTheme(loadTheme());

if (matchMedia("(display-mode: standalone)").matches) {
	try {
		localStorage.setItem("smallhill.installed.player", new Date().toISOString());
	} catch {}
}

const authFrame = (window !== window.top || !!window.opener) && /[#?&]state=/.test(location.hash + location.search);

if (authFrame) {
	import("@azure/msal-browser/redirect-bridge")
		.then(({ broadcastResponseToMainFrame }) => broadcastResponseToMainFrame())
		.catch((err) => console.error(err));
} else {
	bootstrapApplication(App, appConfig).catch((err) => console.error(err));
}
