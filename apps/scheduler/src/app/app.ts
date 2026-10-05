import { Component, inject } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";
import { I18n, LANGS } from "./i18n";

@Component({
	imports: [RouterOutlet, RouterLink],
	selector: "app-root",
	template: `
		<header>
			<a routerLink="/" class="brand"><img src="icon.svg" alt="" width="28" height="28" /> Scheduler</a>
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
		</header>
		<main>
			<router-outlet />
		</main>
		<footer class="muted small">{{ i18n.t().footer }}</footer>
	`,
	styles: `
		:host {
			display: block;
			max-width: 760px;
			margin: 0 auto;
			padding: 0 1rem;
		}
		header {
			padding: 1rem 0;
			display: flex;
			align-items: center;
			justify-content: space-between;
		}
		.langs button {
			color: var(--muted);
		}
		.langs button.on {
			color: var(--accent);
			font-weight: 700;
		}
		.brand {
			display: inline-flex;
			align-items: center;
			gap: 0.5rem;
			font-weight: 700;
			font-size: 1.1rem;
			color: var(--text);
			text-decoration: none;
		}
		footer {
			padding: 1.5rem 0 2rem;
			text-align: center;
		}
	`,
})
export class App {
	protected readonly i18n = inject(I18n);
	protected readonly langs = LANGS;
}
