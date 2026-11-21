import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode } from "@angular/core";
import { provideServiceWorker } from "@angular/service-worker";

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideServiceWorker("sw.js", {
			enabled: !isDevMode(),
			registrationStrategy: "registerImmediately",
		}),
	],
};
