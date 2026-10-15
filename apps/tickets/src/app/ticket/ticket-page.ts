import { Component, computed, inject, input, signal } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { Api, ApiFailure, type ApiError } from "../api";
import { when } from "../format";
import { I18n } from "../i18n";

@Component({
	selector: "app-ticket-page",
	imports: [RouterLink],
	template: `
		<a routerLink="/" class="button back">← {{ t().back }}</a>
		@if (ticket(); as ticket) {
			<h1>{{ ticket.name }}</h1>
			<p>
				{{ whenText() }}<br />
				<span class="muted">{{ ticket.venue }} · {{ t().ticketCount(ticket.count) }}</span>
			</p>
			@if (error()) {
				<p class="error" role="alert">{{ message(error()!) }}</p>
			}
			@if (images(); as images) {
				@for (src of images; track $index) {
					<img class="page" [src]="src" [alt]="ticket.name" />
				}
				<p class="muted small">{{ t().savedOffline }}</p>
			} @else if (busy()) {
				<p class="muted">{{ t().loadingTicket }}</p>
			}
			<div class="actions">
				<button type="button" (click)="load()" [disabled]="busy()">
					{{ busy() ? t().refreshing : t().refresh }}
				</button>
				@if (ticket.mobile) {
					<a class="button" [href]="ticket.mobile" target="_blank" rel="noopener">{{ t().openInGoout }}</a>
				}
			</div>
		}
	`,
	styles: `
		.back {
			margin-bottom: 1rem;
		}
		.page {
			display: block;
			width: 100%;
			height: auto;
			background: #fff;
			border: 1px solid var(--border);
			margin-bottom: 1rem;
			image-rendering: pixelated;
		}
		.actions {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
		}
	`,
})
export class TicketPage {
	readonly id = input.required<string>();
	private readonly api = inject(Api);
	private readonly router = inject(Router);
	private readonly i18n = inject(I18n);
	protected readonly t = this.i18n.t;
	protected readonly ticket = computed(() => this.api.ticket(this.id()));
	protected readonly whenText = computed(() => {
		const ticket = this.ticket();
		return ticket ? when(ticket, this.i18n.locale()) : "";
	});
	protected readonly images = signal<string[] | null>(null);
	protected readonly busy = signal(false);
	protected readonly error = signal<ApiError | null>(null);

	ngOnInit() {
		if (!this.ticket()) {
			this.router.navigateByUrl("/");
			return;
		}
		const saved = this.api.savedImages(this.id());
		this.images.set(saved);
		if (!saved) this.load();
	}

	protected async load() {
		const ticket = this.ticket();
		if (!ticket) return;
		this.busy.set(true);
		this.error.set(null);
		try {
			this.images.set(await this.api.loadImages(ticket));
		} catch (e) {
			const kind = e instanceof ApiFailure ? e.kind : "failed";
			this.error.set(kind);
			if (kind === "login") this.router.navigateByUrl("/");
		} finally {
			this.busy.set(false);
		}
	}

	protected message(error: ApiError) {
		const t = this.t();
		switch (error) {
			case "emailed":
				return t.emailed;
			case "offline":
				return t.offline;
			case "login":
				return t.sessionExpired;
			default:
				return t.ticketFailed;
		}
	}
}
