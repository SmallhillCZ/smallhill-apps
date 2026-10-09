import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/app.config";
import { App } from "./app/app";
import { lang } from "./app/i18n";
import { NOTICE_KEY, TOKEN_KEY } from "./app/sonos/sonos.service";
import { applyTheme, loadTheme } from "./app/theme";

document.documentElement.lang = lang();
applyTheme(loadTheme());

if (matchMedia("(display-mode: standalone)").matches) {
	try {
		localStorage.setItem("smallhill.installed.player", new Date().toISOString());
	} catch {}
}

if (location.hash.startsWith("#sonos=") || location.hash === "#sonos-error") {
	try {
		if (location.hash === "#sonos-error") sessionStorage.setItem(NOTICE_KEY, "connectError");
		else {
			localStorage.setItem(TOKEN_KEY, decodeURIComponent(location.hash.slice("#sonos=".length)));
			sessionStorage.setItem(NOTICE_KEY, "connected");
		}
	} catch {}
	history.replaceState(history.state, "", location.pathname + location.search);
}

const authFrame = (window !== window.top || !!window.opener) && /[#?&]state=/.test(location.hash + location.search);

if (authFrame) {
	import("@azure/msal-browser/redirect-bridge")
		.then(({ broadcastResponseToMainFrame }) => broadcastResponseToMainFrame())
		.catch((err) => console.error(err));
} else {
	bootstrapApplication(App, appConfig).catch((err) => console.error(err));
}
