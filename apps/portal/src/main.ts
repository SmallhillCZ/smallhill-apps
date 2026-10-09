import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/app.config";
import { App } from "./app/app";
import { initTheme } from "./app/theme";

initTheme();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
