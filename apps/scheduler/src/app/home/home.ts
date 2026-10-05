import { Component, computed, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { I18n } from "../i18n";
import { LocalStore } from "../local-store";

@Component({
	selector: "app-home",
	imports: [RouterLink],
	template: `
		<section class="hero">
			<h1>{{ t().heroTitle }}</h1>
			<p class="muted">{{ t().heroText }}</p>
			<a class="button primary" routerLink="/new">{{ t().createPoll }}</a>
		</section>

		@if (mine().length) {
			<section class="card">
				<h2>{{ t().yourPolls }}</h2>
				<p class="muted small">{{ t().rememberedHere }}</p>
				<ul>
					@for (p of mine(); track p.id) {
						<li>
							<a [routerLink]="['/p', p.id]">{{ p.title || t().untitled }}</a>
							<span class="muted small">{{ p.adminKey ? t().youCreated : t().youAnswered }}</span>
							<span class="spacer"></span>
							<button
								class="link small"
								(click)="store.forget(p.id)"
								[attr.aria-label]="t().forget + ' ' + p.title"
							>
								{{ t().forget }}
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
	protected readonly t = inject(I18n).t;
	protected readonly mine = computed(() =>
		Object.values(this.store.polls())
			.filter((p) => p.adminKey || p.response)
			.sort((a, b) => b.seenAt.localeCompare(a.seenAt)),
	);
}
