import type { Poll, Slot } from "./api";

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoTime(d: Date): string {
	return d.toTimeString().slice(0, 5);
}

/** Combines a local date and HH:mm into an ISO timestamp. */
export function toInstant(date: string, time: string): string {
	return new Date(`${date}T${time}`).toISOString();
}

export const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const dayFmt = new Intl.DateTimeFormat(undefined, {
	weekday: "short",
	day: "numeric",
	month: "short",
	year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export const formatDay = (iso: string) => dayFmt.format(new Date(iso));
export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatRange = (slot: Pick<Slot, "start" | "end">) => {
	const sameDay = isoDate(new Date(slot.start)) === isoDate(new Date(slot.end));
	return sameDay
		? `${formatTime(slot.start)} – ${formatTime(slot.end)}`
		: `${formatTime(slot.start)} – ${formatDay(slot.end)} ${formatTime(slot.end)}`;
};

/** Groups slots by their local start date, keeping order. */
export function groupByDay<T extends Pick<Slot, "start">>(slots: T[]): { day: string; slots: T[] }[] {
	const groups: { day: string; slots: T[] }[] = [];
	for (const s of slots) {
		const day = isoDate(new Date(s.start));
		const last = groups.at(-1);
		if (last?.day === day) last.slots.push(s);
		else groups.push({ day, slots: [s] });
	}
	return groups;
}

/** A minimal iCalendar file for the chosen slot. */
export function icsFor(poll: Poll, slot: Slot, url: string): string {
	const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
	const esc = (s: string) =>
		s
			.replace(/\\/g, "\\\\")
			.replace(/\n/g, "\\n")
			.replace(/([,;])/g, "\\$1");
	return [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Scheduler//EN",
		"BEGIN:VEVENT",
		`UID:${poll.id}-${slot.id}@scheduler`,
		`DTSTAMP:${stamp(new Date().toISOString())}`,
		`DTSTART:${stamp(new Date(slot.start).toISOString())}`,
		`DTEND:${stamp(new Date(slot.end).toISOString())}`,
		`SUMMARY:${esc(poll.title)}`,
		poll.location ? `LOCATION:${esc(poll.location)}` : "",
		`DESCRIPTION:${esc([poll.description, url].filter(Boolean).join("\n\n"))}`,
		"END:VEVENT",
		"END:VCALENDAR",
	]
		.filter(Boolean)
		.join("\r\n");
}
