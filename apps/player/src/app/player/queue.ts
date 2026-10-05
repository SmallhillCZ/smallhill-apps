export type Repeat = "off" | "all" | "one";

export interface Queue {
	order: number[];
	pos: number;
}

export function shuffled(length: number, first: number, random: () => number = Math.random): number[] {
	const rest = Array.from({ length }, (_, i) => i).filter((i) => i !== first);
	for (let i = rest.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[rest[i], rest[j]] = [rest[j], rest[i]];
	}
	return [first, ...rest];
}

export function createQueue(length: number, start: number, shuffle: boolean, random?: () => number): Queue {
	if (!shuffle) return { order: Array.from({ length }, (_, i) => i), pos: start };
	return { order: shuffled(length, start, random), pos: 0 };
}

export function reshuffle(queue: Queue, shuffle: boolean, random?: () => number): Queue {
	const current = queue.order[queue.pos];
	return createQueue(queue.order.length, current, shuffle, random);
}

export function nextPos(queue: Queue, repeat: Repeat, auto: boolean): number | null {
	if (!queue.order.length) return null;
	if (auto && repeat === "one") return queue.pos;
	if (queue.pos + 1 < queue.order.length) return queue.pos + 1;
	return repeat === "off" ? null : 0;
}

export function prevPos(queue: Queue, repeat: Repeat): number | null {
	if (!queue.order.length) return null;
	if (queue.pos > 0) return queue.pos - 1;
	return repeat === "off" ? null : queue.order.length - 1;
}
