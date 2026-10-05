import { Component, computed, effect, inject, input, signal } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { Api, errorMessage, type SlotInput } from "../api";
import { I18n } from "../i18n";
import { LocalStore } from "../local-store";
import { SlotPicker, type DayPlan } from "../slot-picker/slot-picker";
import { browserTimezone, isoDate, isoTime, toInstant } from "../time";

/** Creates a poll (/new) or edits one you own (/p/:id/edit). */
@Component({
	selector: "app-poll-form",
	imports: [SlotPicker, RouterLink],
	templateUrl: "./poll-form.html",
	styles: `
		.actions {
			display: flex;
			gap: 0.5rem;
			justify-content: flex-end;
			flex-wrap: wrap;
		}
		.summary {
			margin: 0 auto 0 0;
			align-self: center;
		}
	`,
})
export class PollForm {
	private api = inject(Api);
	private store = inject(LocalStore);
	private router = inject(Router);

	/** Route param; set when editing. */
	readonly id = input<string>();

	protected readonly title = signal("");
	protected readonly description = signal("");
	protected readonly location = signal("");
	protected readonly days = signal<DayPlan[]>([]);
	protected readonly saving = signal(false);
	protected readonly error = signal("");
	protected readonly notOwner = signal(false);
	protected readonly t = inject(I18n).t;
	protected readonly loading = signal(false);
	protected readonly timezone = browserTimezone();

	protected readonly slotCount = computed(() => this.days().reduce((n, d) => n + d.times.length, 0));
	protected readonly problem = computed(() => {
		const t = this.t();
		if (!this.title().trim()) return t.needTitle;
		if (this.slotCount() === 0) return t.needSlot;
		if (this.slotCount() > 100) return t.tooManySlots;
		if (this.days().some((d) => d.times.some((t) => !t.start || !t.end || t.end <= t.start))) return t.badSlot;
		return "";
	});

	constructor() {
		effect(() => {
			const id = this.id();
			if (id) this.load(id);
		});
	}

	private async load(id: string) {
		if (!this.store.get(id)?.adminKey) {
			this.notOwner.set(true);
			return;
		}
		this.loading.set(true);
		try {
			const poll = await this.api.getPoll(id);
			this.title.set(poll.title);
			this.description.set(poll.description);
			this.location.set(poll.location);
			const days = new Map<string, DayPlan>();
			for (const s of poll.slots) {
				const start = new Date(s.start);
				const date = isoDate(start);
				const day = days.get(date) ?? { date, times: [] };
				day.times.push({ id: s.id, start: isoTime(start), end: isoTime(new Date(s.end)) });
				days.set(date, day);
			}
			this.days.set([...days.values()]);
		} catch (e) {
			this.error.set(errorMessage(e, this.t()));
		} finally {
			this.loading.set(false);
		}
	}

	protected async save() {
		if (this.problem() || this.saving()) return;
		this.saving.set(true);
		this.error.set("");
		const slots: SlotInput[] = this.days().flatMap((d) =>
			d.times.map((t) => ({ id: t.id, start: toInstant(d.date, t.start), end: toInstant(d.date, t.end) })),
		);
		const input = {
			title: this.title().trim(),
			description: this.description().trim(),
			location: this.location().trim(),
			timezone: this.timezone,
			slots,
		};
		try {
			const id = this.id();
			if (id) {
				const adminKey = this.store.get(id)!.adminKey!;
				await this.api.updatePoll(id, adminKey, input);
				this.store.remember(id, { title: input.title });
				await this.router.navigate(["/p", id]);
			} else {
				const created = await this.api.createPoll({
					...input,
					slots: slots.map(({ start, end }) => ({ start, end })),
				});
				this.store.remember(created.id, { title: input.title, adminKey: created.adminKey });
				await this.router.navigate(["/p", created.id], { queryParams: { created: 1 } });
			}
		} catch (e) {
			this.error.set(errorMessage(e, this.t()));
		} finally {
			this.saving.set(false);
		}
	}
}
