import type { Ticket } from "./api";

export function dayKey(iso: string): string {
	const d = new Date(iso);
	return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function isToday(ticket: Ticket, now = new Date()): boolean {
	if (!ticket.start) return false;
	const today = dayKey(now.toISOString());
	if (dayKey(ticket.start) === today) return true;
	const start = new Date(ticket.start);
	const end = ticket.end ? new Date(ticket.end) : null;
	return start <= now && !!end && end >= now;
}

export function isOver(ticket: Ticket, now = new Date()): boolean {
	const until = ticket.end ?? ticket.start;
	if (!until) return false;
	const limit = new Date(until);
	if (!ticket.end) limit.setHours(23, 59, 59);
	return limit < now;
}

export function when(ticket: Ticket, locale: string): string {
	if (!ticket.start) return "";
	const start = new Date(ticket.start);
	const date = start.toLocaleDateString(locale, {
		weekday: "short",
		day: "numeric",
		month: "numeric",
		year: "numeric",
	});
	if (!ticket.hasTime) return date;
	return `${date} ${start.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })}`;
}
