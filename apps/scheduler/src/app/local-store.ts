import { Injectable, signal } from "@angular/core";

/**
 * Everything that identifies "you" lives only in this browser:
 * admin keys for polls you created and edit keys for your answers.
 */
export interface KnownPoll {
	id: string;
	title: string;
	adminKey?: string;
	response?: { id: number; editKey: string; name: string };
	seenAt: string;
}

const STORAGE_KEY = "scheduler.polls.v1";
const NAME_KEY = "scheduler.name";

function read<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

function write(key: string, value: unknown) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Private mode or storage full: the app still works, it just won't remember you.
	}
}

@Injectable({ providedIn: "root" })
export class LocalStore {
	readonly polls = signal<Record<string, KnownPoll>>(read(STORAGE_KEY, {}));

	get(id: string): KnownPoll | undefined {
		return this.polls()[id];
	}

	remember(id: string, patch: Partial<Omit<KnownPoll, "id">>) {
		const current = this.polls()[id];
		const next = {
			...current,
			...patch,
			id,
			title: patch.title ?? current?.title ?? "",
			seenAt: new Date().toISOString(),
		};
		this.polls.update((all) => ({ ...all, [id]: next }));
		write(STORAGE_KEY, this.polls());
	}

	forgetResponse(id: string) {
		const current = this.polls()[id];
		if (!current) return;
		const { response: _, ...rest } = current;
		this.polls.update((all) => ({ ...all, [id]: rest }));
		write(STORAGE_KEY, this.polls());
	}

	forget(id: string) {
		this.polls.update(({ [id]: _, ...rest }) => rest);
		write(STORAGE_KEY, this.polls());
	}

	get lastName(): string {
		return read(NAME_KEY, "");
	}
	set lastName(name: string) {
		write(NAME_KEY, name);
	}
}
