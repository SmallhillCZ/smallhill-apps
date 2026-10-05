import { Component, computed, inject, model, signal } from "@angular/core";
import { I18n } from "../i18n";
import { formatDay, isoDate } from "../time";

export interface TimeRange {
	id?: number;
	start: string;
	end: string;
}

export interface DayPlan {
	date: string;
	times: TimeRange[];
}

const DEFAULT_TIMES: TimeRange[] = [{ start: "10:00", end: "11:00" }];

/** Pick days on a calendar, then one or more time ranges for each day. */
@Component({
	selector: "app-slot-picker",
	templateUrl: "./slot-picker.html",
	styleUrl: "./slot-picker.css",
})
export class SlotPicker {
	readonly days = model.required<DayPlan[]>();
	protected readonly i18n = inject(I18n);
	protected readonly t = this.i18n.t;

	private readonly today = isoDate(new Date());
	protected readonly month = signal(startOfMonth(new Date()));
	protected readonly weekdays = computed(() => weekdayNames(this.i18n.locale()));
	protected readonly formatDay = (d: string) => formatDay(`${d}T12:00`);

	protected readonly monthLabel = computed(() =>
		new Intl.DateTimeFormat(this.i18n.locale(), { month: "long", year: "numeric" }).format(this.month()),
	);

	protected readonly selected = computed(() => new Set(this.days().map((d) => d.date)));

	protected readonly cells = computed(() => {
		const first = this.month();
		// Weeks start on Monday.
		const offset = (first.getDay() + 6) % 7;
		const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
		const cells: ({ date: string; label: number; past: boolean } | null)[] = Array(offset).fill(null);
		for (let d = 1; d <= daysInMonth; d++) {
			const date = isoDate(new Date(first.getFullYear(), first.getMonth(), d));
			cells.push({ date, label: d, past: date < this.today });
		}
		return cells;
	});

	protected readonly canGoBack = computed(() => this.month() > startOfMonth(new Date()));

	protected shiftMonth(delta: number) {
		const m = this.month();
		this.month.set(new Date(m.getFullYear(), m.getMonth() + delta, 1));
	}

	protected toggle(date: string) {
		if (this.selected().has(date)) {
			this.days.update((days) => days.filter((d) => d.date !== date));
			return;
		}
		// New days start with the times of the latest day you set up.
		const template = this.days().at(-1)?.times ?? DEFAULT_TIMES;
		const times = template.map(({ start, end }) => ({ start, end }));
		this.days.update((days) => [...days, { date, times }].sort((a, b) => a.date.localeCompare(b.date)));
	}

	protected removeDay(date: string) {
		this.days.update((days) => days.filter((d) => d.date !== date));
	}

	protected addTime(date: string) {
		this.updateDay(date, (times) => {
			const last = times.at(-1);
			if (!last) return [...DEFAULT_TIMES];
			const duration = minutes(last.end) - minutes(last.start);
			const start = Math.min(minutes(last.end), 23 * 60);
			const end = Math.min(start + (duration > 0 ? duration : 60), 23 * 60 + 59);
			return [...times, { start: hhmm(start), end: hhmm(end) }];
		});
	}

	protected removeTime(date: string, index: number) {
		this.updateDay(date, (times) => times.filter((_, i) => i !== index));
	}

	protected setTime(date: string, index: number, field: "start" | "end", value: string) {
		this.updateDay(date, (times) =>
			times.map((t, i) => {
				if (i !== index) return t;
				const next = { ...t, [field]: value };
				// Moving the start keeps the duration, so editing a slot is one change, not two.
				if (field === "start" && value && t.start && t.end) {
					const end = minutes(value) + minutes(t.end) - minutes(t.start);
					if (end > minutes(value) && end < 24 * 60) next.end = hhmm(end);
				}
				return next;
			}),
		);
	}

	protected copyToAll(date: string) {
		const source = this.days().find((d) => d.date === date);
		if (!source) return;
		this.days.update((days) =>
			days.map((d) =>
				d.date === date
					? d
					: {
							date: d.date,
							// Reuse ids where the slot count matches so existing answers survive.
							times: source.times.map((t, i) => ({ id: d.times[i]?.id, start: t.start, end: t.end })),
						},
			),
		);
	}

	protected invalid(t: TimeRange) {
		return !t.start || !t.end || t.end <= t.start;
	}

	private updateDay(date: string, fn: (times: TimeRange[]) => TimeRange[]) {
		this.days.update((days) => days.map((d) => (d.date === date ? { ...d, times: fn(d.times) } : d)));
	}
}

function startOfMonth(d: Date) {
	return new Date(d.getFullYear(), d.getMonth(), 1);
}

function weekdayNames(locale: string) {
	const fmt = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
	// 2024-01-01 was a Monday.
	return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 1 + i)));
}

const minutes = (t: string) => {
	const [h, m] = t.split(":").map(Number);
	return h * 60 + m;
};
const hhmm = (mins: number) =>
	`${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
