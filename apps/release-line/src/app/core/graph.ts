export interface GraphCommit {
	oid: string;
	parents: string[];
	date: string;
}

export interface GraphNode<C extends GraphCommit> {
	commit: C;
	row: number;
	lane: number;
}

export interface GraphEdge {
	fromRow: number;
	fromLane: number;
	lane: number;
	toRow: number | null;
	toLane: number;
}

export interface Graph<C extends GraphCommit> {
	nodes: GraphNode<C>[];
	edges: GraphEdge[];
	lanes: number;
}

export function topoSort<C extends GraphCommit>(commits: C[]): C[] {
	const byOid = new Map(commits.map((c) => [c.oid, c]));
	const children = new Map<string, number>();
	for (const c of commits) {
		for (const p of new Set(c.parents)) if (byOid.has(p)) children.set(p, (children.get(p) ?? 0) + 1);
	}
	const newer = (a: C, b: C) => (a.date === b.date ? (a.oid < b.oid ? -1 : 1) : a.date > b.date ? -1 : 1);
	const ready = commits.filter((c) => !children.get(c.oid)).sort(newer);
	const out: C[] = [];
	while (ready.length) {
		const c = ready.shift()!;
		out.push(c);
		for (const p of new Set(c.parents)) {
			const parent = byOid.get(p);
			if (!parent) continue;
			const left = children.get(p)! - 1;
			children.set(p, left);
			if (left === 0) {
				const at = ready.findIndex((r) => newer(parent, r) < 0);
				ready.splice(at < 0 ? ready.length : at, 0, parent);
			}
		}
	}
	return out;
}

export function layout<C extends GraphCommit>(commits: C[], mainHead?: string): Graph<C> {
	const order = topoSort(commits);
	const present = new Set(commits.map((c) => c.oid));
	const lanes: (string | null)[] = mainHead && commits.some((c) => c.oid === mainHead) ? [mainHead] : [];
	const nodes: GraphNode<C>[] = [];
	const open: { fromRow: number; fromLane: number; lane: number; parent: string }[] = [];
	let width = lanes.length;

	const free = (avoid: number) => {
		for (let i = 0; i < lanes.length; i++) if (lanes[i] === null && i !== avoid) return i;
		lanes.push(null);
		return lanes.length - 1;
	};

	order.forEach((commit, row) => {
		let lane = lanes.indexOf(commit.oid);
		if (lane < 0) lane = free(-1);
		for (let i = 0; i < lanes.length; i++) if (lanes[i] === commit.oid) lanes[i] = null;
		nodes.push({ commit, row, lane });
		commit.parents.forEach((parent, k) => {
			if (!present.has(parent)) {
				if (k === 0) open.push({ fromRow: row, fromLane: lane, lane, parent });
				return;
			}
			let travel: number;
			if (k === 0) {
				travel = lane;
			} else {
				travel = lanes.indexOf(parent);
				if (travel < 0) travel = free(lane);
			}
			lanes[travel] = parent;
			open.push({ fromRow: row, fromLane: lane, lane: travel, parent });
		});
		while (lanes.length && lanes[lanes.length - 1] === null) lanes.pop();
		width = Math.max(width, lanes.length, lane + 1);
	});

	const at = new Map(nodes.map((n) => [n.commit.oid, n]));
	const edges = open.map(({ fromRow, fromLane, lane, parent }) => {
		const target = at.get(parent);
		return { fromRow, fromLane, lane, toRow: target?.row ?? null, toLane: target?.lane ?? lane };
	});
	return { nodes, edges, lanes: Math.max(width, 1) };
}

export interface Geometry {
	row: number;
	lane: number;
	pad: number;
}

export function edgePath(e: GraphEdge, g: Geometry, bottom: number): string {
	const x = (l: number) => g.pad + l * g.lane;
	const y = (r: number) => r * g.row + g.row / 2;
	const curve = (x1: number, y1: number, x2: number, y2: number) => {
		const m = (y1 + y2) / 2;
		return `C ${x1} ${m} ${x2} ${m} ${x2} ${y2}`;
	};
	const x0 = x(e.fromLane);
	const y0 = y(e.fromRow);
	const xt = x(e.lane);
	const parts = [`M ${x0} ${y0}`];
	if (e.toRow === null) return `${parts[0]} L ${x0} ${Math.min(bottom, y0 + g.row)}`;
	const x1 = x(e.toLane);
	const y1 = y(e.toRow);
	if (xt !== x0 && xt !== x1 && e.toRow - e.fromRow < 2) return `${parts[0]} ${curve(x0, y0, x1, y1)}`;
	let cy = y0;
	if (xt !== x0) {
		cy = y0 + g.row;
		parts.push(curve(x0, y0, xt, cy));
	}
	if (xt !== x1) {
		const sy = Math.max(cy, y1 - g.row);
		if (sy > cy) parts.push(`L ${xt} ${sy}`);
		parts.push(curve(xt, sy, x1, y1));
	} else {
		parts.push(`L ${x1} ${y1}`);
	}
	return parts.join(" ");
}
