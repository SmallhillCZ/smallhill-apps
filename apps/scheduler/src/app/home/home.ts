import { Component, computed, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { LocalStore } from "../local-store";

@Component({
	selector: "app-home",
	imports: [RouterLink],
	template: `
		<section class="hero">
			<h1>Find a time that works for everyone</h1>
			<p class="muted">
				Suggest a few times, send one link, and see who can make it. Nobody needs an account, and there are no
				ads or trackers.
			</p>
			<a class="button primary" routerLink="/new">Create a poll</a>
		</section>

		@if (mine().length) {
			<section class="card">
				<h2>Your polls</h2>
				<p class="muted small">Remembered in this browser only.</p>
				<ul>
					@for (p of mine(); track p.id) {
						<li>
							<a [routerLink]="['/p', p.id]">{{ p.title || "Untitled poll" }}</a>
							<span class="muted small">{{ p.adminKey ? "you created it" : "you answered" }}</span>
							<span class="spacer"></span>
							<button
								class="link small"
								(click)="store.forget(p.id)"
								[attr.aria-label]="'Forget ' + p.title"
							>
								Forget
							</button>
						</li>
					}
				</ul>
			</section>
		}
	`,
	styles: `
		.hero {
			padding: 2rem 0 2.5rem;
		}
		.hero p {
			font-size: 1.1rem;
			max-width: 34rem;
		}
		ul {
			list-style: none;
			padding: 0;
			margin: 0;
		}
		li {
			display: flex;
			gap: 0.5rem;
			align-items: baseline;
			padding: 0.4rem 0;
			border-top: 1px solid var(--border);
		}
		li:first-child {
			border-top: none;
		}
	`,
})
export class Home {
	protected readonly store = inject(LocalStore);
	protected readonly mine = computed(() =>
		Object.values(this.store.polls())
			.filter((p) => p.adminKey || p.response)
			.sort((a, b) => b.seenAt.localeCompare(a.seenAt)),
	);
}
