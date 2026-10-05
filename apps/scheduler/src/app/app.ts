import { Component } from "@angular/core";
import { RouterLink, RouterOutlet } from "@angular/router";

@Component({
	imports: [RouterOutlet, RouterLink],
	selector: "app-root",
	template: `
		<header>
			<a routerLink="/" class="brand"><img src="icon.svg" alt="" width="28" height="28" /> Scheduler</a>
		</header>
		<main>
			<router-outlet />
		</main>
		<footer class="muted small">
			No sign-up, no ads, no tracking. Polls are deleted 60 days after their last time slot.
		</footer>
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
export class App {}
