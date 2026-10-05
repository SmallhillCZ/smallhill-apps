import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/app.config";
import { App } from "./app/app";

if (matchMedia("(display-mode: standalone)").matches) {
	try {
		localStorage.setItem("smallhill.installed.scheduler", new Date().toISOString());
	} catch {}
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
