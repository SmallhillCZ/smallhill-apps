import { createQueue, nextPos, prevPos, reshuffle } from "./queue";

describe("queue", () => {
	it("plays in order from the chosen track", () => {
		const queue = createQueue(4, 2, false);
		expect(queue).toEqual({ order: [0, 1, 2, 3], pos: 2 });
		expect(nextPos(queue, "off", true)).toBe(3);
		expect(prevPos(queue, "off")).toBe(1);
	});

	it("stops or wraps at the ends depending on repeat", () => {
		const last = { order: [0, 1, 2], pos: 2 };
		expect(nextPos(last, "off", true)).toBeNull();
		expect(nextPos(last, "all", true)).toBe(0);
		const first = { order: [0, 1, 2], pos: 0 };
		expect(prevPos(first, "off")).toBeNull();
		expect(prevPos(first, "all")).toBe(2);
	});

	it("repeats one track only when it ends by itself", () => {
		const queue = { order: [0, 1, 2], pos: 1 };
		expect(nextPos(queue, "one", true)).toBe(1);
		expect(nextPos(queue, "one", false)).toBe(2);
	});

	it("shuffles every track exactly once starting with the chosen one", () => {
		const queue = createQueue(10, 4, true);
		expect(queue.pos).toBe(0);
		expect(queue.order[0]).toBe(4);
		expect([...queue.order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
	});

	it("keeps the current track when toggling shuffle", () => {
		const shuffledQueue = reshuffle({ order: [0, 1, 2, 3], pos: 3 }, true);
		expect(shuffledQueue.order[shuffledQueue.pos]).toBe(3);
		const ordered = reshuffle(shuffledQueue, false);
		expect(ordered).toEqual({ order: [0, 1, 2, 3], pos: 3 });
	});
});
