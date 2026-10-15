import { Component, computed, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Api, ApiFailure, type ApiError } from "../api";
import { isOver, isToday, when } from "../format";
import { I18n } from "../i18n";

@Component({
	selector: "app-home",
	imports: [RouterLink],
	template: `
		@if (!api.loggedIn()) {
			<form class="card" (submit)="login($event)">
				<h1>{{ t().loginTitle }}</h1>
				<p>{{ t().loginText }}</p>
				@if (error()) {
					<p class="error" role="alert">{{ message(error()!) }}</p>
				}
				<div class="field">
					<label for="email">{{ t().email }}</label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="username"
						required
						[value]="email()"
						(input)="email.set($any($event.target).value)"
					/>
				</div>
				<div class="field">
					<label for="password">{{ t().password }}</label>
					<input id="password" name="password" type="password" autocomplete="current-password" required />
				</div>
				<button type="submit" class="primary wide" [disabled]="busy()">
					{{ busy() ? t().signingIn : t().signIn }}
				</button>
				<p class="muted small note">{{ t().privacy }}</p>
				<p class="muted small">{{ t().socialHint }}</p>
			</form>
		} @else {
			<div class="head">
				<h1>{{ t().upcoming }}</h1>
				<button type="button" (click)="refresh()" [disabled]="busy()">
					{{ busy() ? t().refreshing : t().refresh }}
				</button>
			</div>
			@if (error()) {
				<p class="error" role="alert">{{ message(error()!) }}</p>
			}
			@if (stale() && api.cached(); as cached) {
				<p class="muted small">{{ t().cachedNote(savedAt(cached.savedAt)) }}</p>
			}
			@for (ticket of tickets(); track ticket.id) {
				<a class="card ticket" [class.today]="ticket.today" [routerLink]="['/t', ticket.id]">
					@if (ticket.today) {
						<span class="badge">{{ t().today }}</span>
					}
					<strong class="name">{{ ticket.name }}</strong>
					<span>{{ ticket.when }}</span>
					<span class="muted">{{ ticket.venue }} · {{ t().ticketCount(ticket.count) }}</span>
				</a>
			} @empty {
				@if (api.cached()) {
					<p class="card muted">{{ t().noTickets }}</p>
				}
			}
		}
	`,
	styles: `
		.note {
			margin-top: 1rem;
		}
		.head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 1rem;
			margin-bottom: 0.75rem;
		}
		.head h1 {
			margin: 0;
		}
		.ticket {
			display: grid;
			gap: 0.15rem;
			color: var(--text);
			text-decoration: none;
		}
		.ticket.today {
			border: 3px solid var(--accent);
		}
		.name {
			font-size: 1.2rem;
		}
		.badge {
			justify-self: start;
			font-size: 0.8rem;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			padding: 0.1rem 0.5rem;
			border-radius: 4px;
			background: var(--accent);
			color: var(--accent-text);
		}
	`,
})
export class Home {
	protected readonly api = inject(Api);
	private readonly i18n = inject(I18n);
	protected readonly t = this.i18n.t;
	protected readonly busy = signal(false);
	protected readonly error = signal<ApiError | null>(null);
	protected readonly stale = signal(true);
	protected readonly email = signal("");

	protected readonly tickets = computed(() => {
		const now = new Date();
		const locale = this.i18n.locale();
		const list = (this.api.cached()?.tickets ?? [])
			.filter((t) => !isOver(t, now))
			.map((t) => ({ ...t, today: isToday(t, now), when: when(t, locale) }));
		return [...list.filter((t) => t.today), ...list.filter((t) => !t.today)];
	});

	constructor() {
		if (this.api.loggedIn()) this.refresh();
	}

	protected async login(event: Event) {
		event.preventDefault();
		const form = event.target as HTMLFormElement;
		const password = (form.elements.namedItem("password") as HTMLInputElement).value;
		await this.run(async () => {
			await this.api.login(this.email().trim(), password);
			form.reset();
			await this.api.refresh();
			this.stale.set(false);
		});
	}

	protected async refresh() {
		await this.run(async () => {
			await this.api.refresh();
			this.stale.set(false);
		});
	}

	private async run(task: () => Promise<void>) {
		this.busy.set(true);
		this.error.set(null);
		try {
			await task();
		} catch (e) {
			this.error.set(e instanceof ApiFailure ? e.kind : "failed");
		} finally {
			this.busy.set(false);
		}
	}

	protected savedAt(iso: string) {
		return new Date(iso).toLocaleString(this.i18n.locale(), {
			day: "numeric",
			month: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
	}

	protected message(error: ApiError) {
		const t = this.t();
		switch (error) {
			case "credentials":
				return t.badCredentials;
			case "login":
				return t.sessionExpired;
			case "offline":
				return t.offline;
			default:
				return t.gooutDown;
		}
	}
}
