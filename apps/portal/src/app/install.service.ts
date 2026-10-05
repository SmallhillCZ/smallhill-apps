import { Injectable, signal } from "@angular/core";
import { AppInfo } from "./apps";

export type InstallState = "idle" | "installing" | "installed" | "help";

type InstallableNavigator = Navigator & { install?: (installUrl?: string, manifestId?: string) => Promise<unknown> };

const INSTALLED_KEY = "smallhill.installed.";

function isMarkedInstalled(app: AppInfo): boolean {
	try {
		return localStorage.getItem(INSTALLED_KEY + app.id) !== null;
	} catch {
		return false;
	}
}

function markInstalled(app: AppInfo): void {
	try {
		localStorage.setItem(INSTALLED_KEY + app.id, new Date().toISOString());
	} catch {}
}

@Injectable({ providedIn: "root" })
export class InstallService {
	private readonly states = signal<Record<string, InstallState>>({});

	readonly supported = typeof (navigator as InstallableNavigator).install === "function";

	state(app: AppInfo): InstallState {
		return this.states()[app.id] ?? (isMarkedInstalled(app) ? "installed" : "idle");
	}

	absoluteUrl(app: AppInfo): string {
		return new URL(app.url!, document.baseURI).href;
	}

	async install(app: AppInfo): Promise<InstallState> {
		if (!app.url) return this.state(app);
		const nav = navigator as InstallableNavigator;
		if (!nav.install) {
			return this.set(app, "help");
		}
		this.set(app, "installing");
		const url = this.absoluteUrl(app);
		try {
			await nav.install(url, url);
			markInstalled(app);
			return this.set(app, "installed");
		} catch (err) {
			return this.set(app, err instanceof DOMException && err.name === "AbortError" ? "idle" : "help");
		}
	}

	private set(app: AppInfo, state: InstallState): InstallState {
		this.states.update((states) => ({ ...states, [app.id]: state }));
		return state;
	}
}
