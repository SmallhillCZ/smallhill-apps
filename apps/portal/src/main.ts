import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/app.config";
import { App } from "./app/app";
import { LANG } from "./app/i18n";

document.documentElement.lang = LANG;

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
