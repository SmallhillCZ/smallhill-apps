import { Injectable, signal } from "@angular/core";
import { AppInfo } from "./apps";

export type InstallState = "idle" | "installing" | "installed" | "help";

type InstallableNavigator = Navigator & { install?: (installUrl?: string, manifestId?: string) => Promise<unknown> };

@Injectable({ providedIn: "root" })
export class InstallService {
	private readonly states = signal<Record<string, InstallState>>({});

	readonly supported = typeof (navigator as InstallableNavigator).install === "function";

	state(app: AppInfo): InstallState {
		return this.states()[app.id] ?? "idle";
	}

	absoluteUrl(app: AppInfo): string {
		return new URL(app.url!, document.baseURI).href;
	}

	async install(app: AppInfo): Promise<void> {
		if (!app.url) return;
		const nav = navigator as InstallableNavigator;
		if (!nav.install) {
			this.set(app, "help");
			return;
		}
		this.set(app, "installing");
		const url = this.absoluteUrl(app);
		try {
			await nav.install(url, url);
			this.set(app, "installed");
		} catch (err) {
			this.set(app, err instanceof DOMException && err.name === "AbortError" ? "idle" : "help");
		}
	}

	private set(app: AppInfo, state: InstallState): void {
		this.states.update((states) => ({ ...states, [app.id]: state }));
	}
}
