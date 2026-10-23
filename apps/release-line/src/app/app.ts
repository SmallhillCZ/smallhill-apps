import { Component, inject, signal } from "@angular/core";
import { Router, RouterLink, RouterOutlet } from "@angular/router";
import { Auth } from "./auth";
import { I18n, LANGS } from "./i18n";
import { Store } from "./store";
import { THEMES, Theme, applyTheme, loadTheme } from "./theme";

@Component({
	imports: [RouterOutlet, RouterLink],
	selector: "app-root",
	template: `
		<header>
			<a routerLink="/" class="brand"
				><img src="icon.svg" alt="" width="28" height="28" /> <span>{{ i18n.t().appName }}</span></a
			>
			<button
				type="button"
				class="more"
				popovertarget="menu"
				[attr.aria-label]="i18n.t().menu"
				[title]="i18n.t().menu"
			>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<circle cx="12" cy="5" r="2" />
					<circle cx="12" cy="12" r="2" />
					<circle cx="12" cy="19" r="2" />
				</svg>
			</button>
			<div id="menu" class="menu" popover>
				<div class="menu-row">
					<span>{{ i18n.t().language }}</span>
					<div class="langs" role="group" [attr.aria-label]="i18n.t().language">
						@for (l of langs; track l) {
							<button
								type="button"
								class="link small"
								[class.on]="i18n.lang() === l"
								[attr.aria-pressed]="i18n.lang() === l"
								[attr.lang]="l"
								(click)="i18n.setLang(l)"
							>
								{{ l.toUpperCase() }}
							</button>
						}
					</div>
				</div>
				<div class="menu-row">
					<span>{{ i18n.t().theme }}</span>
					<select
						class="theme"
						[attr.aria-label]="i18n.t().theme"
						[value]="theme()"
						(change)="setTheme($any($event.target).value)"
					>
						@for (option of themes; track option) {
							<option [value]="option" [selected]="option === theme()">
								{{ i18n.t().themes[option] }}
							</option>
						}
					</select>
				</div>
				@if (auth.signedIn()) {
					<div class="menu-row">
						<button type="button" class="link logout" (click)="signOut()">{{ i18n.t().signOut }}</button>
					</div>
				}
			</div>
		</header>
		<main>
			<router-outlet />
		</main>
	`,
	styles: `
		:host {
			display: block;
			max-width: 1440px;
			margin: 0 auto;
			padding: 0 1rem;
		}
		header {
			padding: 0.75rem 0;
			display: flex;
			align-items: center;
			justify-content: space-between;
		}
		.more {
			display: grid;
			place-items: center;
			width: 40px;
			height: 40px;
			margin-right: -8px;
			padding: 0;
			border: 0;
			border-radius: 50%;
			background: transparent;
			color: var(--muted);
		}
		.more svg {
			width: 20px;
			height: 20px;
			fill: currentColor;
		}
		.menu {
			position: fixed;
			inset: auto;
			top: calc(max(12px, env(safe-area-inset-top)) + 40px);
			right: max(16px, env(safe-area-inset-right), calc((100vw - 1440px) / 2 + 16px));
			margin: 0;
			min-width: 240px;
			padding: 0.25rem 1rem;
			border: 1px solid var(--border);
			border-radius: var(--radius);
			background: var(--surface);
			color: var(--text);
			box-shadow: var(--shadow);
		}
		.menu:popover-open {
			display: grid;
		}
		.menu-row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 1rem;
			min-height: 44px;
		}
		.menu-row + .menu-row {
			border-top: 1px solid var(--border);
		}
		.menu-row > span {
			font-weight: 600;
		}
		.langs {
			display: flex;
			gap: 2px;
		}
		.langs button {
			color: var(--muted);
		}
		.langs button.on {
			color: var(--accent);
			font-weight: 700;
		}
		.theme {
			font: inherit;
			font-size: 0.9rem;
			color: var(--text);
			background: var(--bg);
			border: 1px solid var(--border);
			border-radius: 8px;
			padding: 0.3rem 0.5rem;
			cursor: pointer;
		}
		.brand {
			display: inline-flex;
			align-items: center;
			gap: 0.5rem;
			font-weight: 700;
			font-size: 1.05rem;
			color: var(--text);
			text-decoration: none;
		}
		main {
			padding-bottom: 2rem;
		}
		.logout {
			padding-left: 0;
		}
	`,
})
export class App {
	protected readonly i18n = inject(I18n);
	protected readonly auth = inject(Auth);
	private readonly store = inject(Store);
	private readonly router = inject(Router);
	protected readonly langs = LANGS;
	protected readonly themes = THEMES;
	protected readonly theme = signal<Theme>(loadTheme());

	constructor() {
		applyTheme(this.theme());
		if (this.auth.signedIn()) this.store.watch();
	}

	protected signOut() {
		document.getElementById("menu")?.hidePopover();
		this.auth.setToken(null);
		this.router.navigateByUrl("/");
	}

	protected setTheme(theme: Theme) {
		this.theme.set(theme);
		applyTheme(theme);
	}
}
