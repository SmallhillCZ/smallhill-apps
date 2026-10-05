import { HttpClient, HttpErrorResponse, HttpHeaders } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

// URLs are relative so they resolve against <base href>, e.g. /scheduler/api/... in production.

export type Vote = "yes" | "maybe" | "no";

export interface Slot {
	id: number;
	start: string;
	end: string;
}

export interface Participant {
	id: number;
	name: string;
	votes: Record<number, Vote>;
}

export interface Poll {
	id: string;
	title: string;
	description: string;
	location: string;
	timezone: string;
	closed: boolean;
	finalSlotId: number | null;
	createdAt: string;
	slots: Slot[];
	responses: Participant[];
}

export interface SlotInput {
	id?: number;
	start: string;
	end: string;
}

export interface PollInput {
	title: string;
	description: string;
	location: string;
	timezone: string;
	slots: SlotInput[];
}

/** Turns an HTTP failure into a sentence we can show. */
export function errorMessage(e: unknown): string {
	if (e instanceof HttpErrorResponse) {
		if (e.status === 0) return "Cannot reach the server. Check your connection and try again.";
		if (typeof e.error?.error === "string") return e.error.error;
		if (typeof e.error?.message === "string") return e.error.message;
	}
	return "Something went wrong. Please try again.";
}

@Injectable({ providedIn: "root" })
export class Api {
	private http = inject(HttpClient);

	getPoll(id: string) {
		return firstValueFrom(this.http.get<Poll>(`api/polls/${encodeURIComponent(id)}`));
	}

	createPoll(input: PollInput) {
		return firstValueFrom(this.http.post<{ id: string; adminKey: string }>("api/polls", input));
	}

	checkAdmin(id: string, adminKey: string) {
		return firstValueFrom(this.http.get(`api/polls/${encodeURIComponent(id)}/admin`, { headers: admin(adminKey) }));
	}

	updatePoll(
		id: string,
		adminKey: string,
		patch: Partial<PollInput> & { closed?: boolean; finalSlotId?: number | null },
	) {
		const { timezone: _, ...body } = patch;
		return firstValueFrom(
			this.http.patch<Poll>(`api/polls/${encodeURIComponent(id)}`, body, { headers: admin(adminKey) }),
		);
	}

	deletePoll(id: string, adminKey: string) {
		return firstValueFrom(this.http.delete(`api/polls/${encodeURIComponent(id)}`, { headers: admin(adminKey) }));
	}

	respond(pollId: string, name: string, votes: Record<number, Vote>) {
		return firstValueFrom(
			this.http.post<{ id: number; editKey: string }>(`api/polls/${encodeURIComponent(pollId)}/responses`, {
				name,
				votes,
			}),
		);
	}

	updateResponse(pollId: string, responseId: number, editKey: string, name: string, votes: Record<number, Vote>) {
		return firstValueFrom(
			this.http.put(
				`api/polls/${encodeURIComponent(pollId)}/responses/${responseId}`,
				{ name, votes },
				{ headers: new HttpHeaders({ "X-Edit-Key": editKey }) },
			),
		);
	}

	deleteResponse(pollId: string, responseId: number, keys: { editKey?: string; adminKey?: string }) {
		let headers = new HttpHeaders();
		if (keys.editKey) headers = headers.set("X-Edit-Key", keys.editKey);
		if (keys.adminKey) headers = headers.set("X-Admin-Key", keys.adminKey);
		return firstValueFrom(
			this.http.delete(`api/polls/${encodeURIComponent(pollId)}/responses/${responseId}`, { headers }),
		);
	}
}

const admin = (key: string) => new HttpHeaders({ "X-Admin-Key": key });
