import { Component, computed, effect, inject, input, signal } from "@angular/core";
import { Title } from "@angular/platform-browser";
import { Router, RouterLink } from "@angular/router";
import { Api, errorMessage, type Poll, type Slot, type Vote } from "../api";
import { LocalStore } from "../local-store";
import { browserTimezone, formatDay, formatRange, groupByDay, icsFor } from "../time";

interface SlotStats {
	slot: Slot;
	yes: string[];
	maybe: string[];
	no: string[];
	score: number;
}

const VOTE_ORDER: Vote[] = ["yes", "maybe", "no"];

@Component({
	selector: "app-poll-page",
	imports: [RouterLink],
	templateUrl: "./poll-page.html",
	styleUrl: "./poll-page.css",
})
export class PollPage {
	private api = inject(Api);
	private store = inject(LocalStore);
	private router = inject(Router);
	private titleService = inject(Title);

	readonly id = input.required<string>();
	/** Set right after creating, to show the share panel. */
	readonly created = input<string>();
	/** Admin key from an admin link; moved into local storage and removed from the URL. */
	readonly admin = input<string>();

	protected readonly poll = signal<Poll | null>(null);
	protected readonly error = signal("");
	protected readonly notFound = signal(false);
	protected readonly busy = signal(false);
	protected readonly copied = signal("");
	protected readonly showGrid = signal(false);

	protected readonly name = signal(this.store.lastName);
	protected readonly myVotes = signal<Record<number, Vote>>({});
	protected readonly editing = signal(false);

	protected readonly formatDay = formatDay;
	protected readonly formatRange = formatRange;
	protected readonly voteOrder = VOTE_ORDER;
	protected readonly voteLabel: Record<Vote, string> = { yes: "Yes", maybe: "If need be", no: "No" };
	protected readonly voteMark: Record<Vote, string> = { yes: "✓", maybe: "~", no: "✕" };
	protected readonly myTimezone = browserTimezone();

	protected readonly known = computed(() => this.store.polls()[this.id()]);
	protected readonly adminKey = computed(() => this.known()?.adminKey);
	protected readonly myResponse = computed(() => {
		const mine = this.known()?.response;
		return mine && this.poll()?.responses.some((r) => r.id === mine.id) ? mine : undefined;
	});
	/** You are filling in the form: either you haven't answered yet or you chose to edit. */
	protected readonly answering = computed(() => !this.poll()?.closed && (!this.myResponse() || this.editing()));

	protected readonly shareUrl = computed(() => new URL(`p/${this.id()}`, document.baseURI).href);
	protected readonly adminUrl = computed(() =>
		this.adminKey() ? `${this.shareUrl()}?admin=${encodeURIComponent(this.adminKey()!)}` : "",
	);

	protected readonly stats = computed<SlotStats[]>(() => {
		const poll = this.poll();
		if (!poll) return [];
		return poll.slots.map((slot) => {
			const s: SlotStats = { slot, yes: [], maybe: [], no: [], score: 0 };
			for (const r of poll.responses) {
				const v = r.votes[slot.id];
				if (v) s[v].push(r.name);
			}
			s.score = s.yes.length + s.maybe.length * 0.5;
			return s;
		});
	});
	protected readonly days = computed(() => groupByDay(this.stats().map((s) => ({ ...s, start: s.slot.start }))));
	protected readonly bestScore = computed(() => Math.max(0, ...this.stats().map((s) => s.score)));
	protected readonly finalSlot = computed(() => {
		const p = this.poll();
		return p?.slots.find((s) => s.id === p.finalSlotId);
	});
	protected readonly timezoneDiffers = computed(() => {
		const p = this.poll();
		return !!p && p.timezone !== this.myTimezone;
	});

	constructor() {
		effect(() => {
			const id = this.id();
			void this.load(id);
		});
		effect(() => {
			const key = this.admin();
			if (key) void this.claimAdmin(this.id(), key);
		});
	}

	private async load(id: string) {
		this.error.set("");
		try {
			const poll = await this.api.getPoll(id);
			this.poll.set(poll);
			this.titleService.setTitle(`${poll.title} · Scheduler`);
			this.store.remember(id, { title: poll.title });
			const mine = this.myResponse();
			if (mine && !this.editing()) {
				const r = poll.responses.find((x) => x.id === mine.id)!;
				this.name.set(r.name);
				this.myVotes.set({ ...r.votes });
			}
		} catch (e: any) {
			if (e?.status === 404) this.notFound.set(true);
			else this.error.set(errorMessage(e));
		}
	}

	private async claimAdmin(id: string, key: string) {
		try {
			await this.api.checkAdmin(id, key);
			this.store.remember(id, { adminKey: key });
		} catch {
			this.error.set("That admin link is not valid for this poll.");
		}
		await this.router.navigate([], {
			queryParams: { admin: null },
			queryParamsHandling: "merge",
			replaceUrl: true,
		});
	}

	protected setVote(slotId: number, vote: Vote) {
		this.myVotes.update((v) => ({ ...v, [slotId]: vote }));
	}

	protected setAll(vote: Vote) {
		this.myVotes.set(Object.fromEntries(this.poll()!.slots.map((s) => [s.id, vote])));
	}

	protected async submit() {
		const poll = this.poll();
		const name = this.name().trim();
		if (!poll || !name || this.busy()) return;
		this.busy.set(true);
		this.error.set("");
		try {
			const mine = this.myResponse();
			if (mine) {
				await this.api.updateResponse(poll.id, mine.id, mine.editKey, name, this.myVotes());
				this.store.remember(poll.id, { response: { ...mine, name } });
			} else {
				const r = await this.api.respond(poll.id, name, this.myVotes());
				this.store.remember(poll.id, { response: { id: r.id, editKey: r.editKey, name } });
			}
			this.store.lastName = name;
			this.editing.set(false);
			await this.load(poll.id);
		} catch (e) {
			this.error.set(errorMessage(e));
		} finally {
			this.busy.set(false);
		}
	}

	protected startEditing() {
		this.editing.set(true);
	}

	protected async cancelEditing() {
		this.editing.set(false);
		await this.load(this.id());
	}

	protected async removeResponse(responseId: number) {
		const poll = this.poll()!;
		const mine = this.myResponse();
		const isMine = mine?.id === responseId;
		const who = poll.responses.find((r) => r.id === responseId)?.name ?? "";
		if (!confirm(isMine ? "Remove your answer?" : `Remove the answer from ${who}?`)) return;
		await this.run(async () => {
			await this.api.deleteResponse(poll.id, responseId, {
				editKey: isMine ? mine!.editKey : undefined,
				adminKey: this.adminKey(),
			});
			if (isMine) {
				this.store.forgetResponse(poll.id);
				this.myVotes.set({});
				this.editing.set(false);
			}
			await this.load(poll.id);
		});
	}

	protected chooseFinal(slotId: number | null) {
		return this.patch({ finalSlotId: slotId, ...(slotId !== null ? { closed: true } : {}) });
	}

	protected setClosed(closed: boolean) {
		return this.patch({ closed });
	}

	private patch(change: { closed?: boolean; finalSlotId?: number | null }) {
		return this.run(async () => {
			this.poll.set(await this.api.updatePoll(this.id(), this.adminKey()!, change));
		});
	}

	protected async deletePoll() {
		if (!confirm("Delete this poll and all answers? This cannot be undone.")) return;
		await this.run(async () => {
			await this.api.deletePoll(this.id(), this.adminKey()!);
			this.store.forget(this.id());
			await this.router.navigate(["/"]);
		});
	}

	protected async copy(text: string, what: string) {
		try {
			await navigator.clipboard.writeText(text);
			this.copied.set(what);
			setTimeout(() => this.copied.set(""), 2000);
		} catch {
			prompt("Copy this link:", text);
		}
	}

	protected readonly canShare = typeof navigator !== "undefined" && "share" in navigator;
	protected share() {
		navigator
			.share({ title: this.poll()?.title, text: "Which times work for you?", url: this.shareUrl() })
			.catch(() => {});
	}

	protected downloadIcs() {
		const poll = this.poll()!;
		const slot = this.finalSlot()!;
		const blob = new Blob([icsFor(poll, slot, this.shareUrl())], { type: "text/calendar" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = `${poll.title.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40) || "event"}.ics`;
		a.click();
		URL.revokeObjectURL(a.href);
	}

	protected voteOf(r: { votes: Record<number, Vote> }, slotId: number) {
		return r.votes[slotId];
	}

	private async run(fn: () => Promise<void>) {
		this.busy.set(true);
		this.error.set("");
		try {
			await fn();
		} catch (e) {
			this.error.set(errorMessage(e));
		} finally {
			this.busy.set(false);
		}
	}
}
