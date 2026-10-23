import {
	Component,
	DestroyRef,
	ElementRef,
	computed,
	effect,
	inject,
	input,
	signal,
	untracked,
	viewChild,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { edgePath } from "../core/graph";
import { isVersionTag, parseFilter, readableText, tagColor } from "../core/tags";
import { autoReleaseTags, matchWorkflow } from "../core/workflows";
import {
	type BranchMode,
	EXPAND_DEPTH,
	type Commit,
	Github,
	GithubFailure,
	type RepoData,
	type Run,
	type WorkflowSet,
} from "../github";
import { I18n } from "../i18n";
import { Store } from "../store";
import { ReleaseDialog, type ReleaseRequest, countBetween } from "./release-dialog";

const LANES = 8;

interface RowRef {
	name: string;
	kind: "release" | "version" | "branch" | "pending";
	color?: string;
	text?: string;
	lane?: number;
	url?: string | null;
}

@Component({
	selector: "app-timeline",
	imports: [RouterLink, ReleaseDialog],
	template: `
		<div class="toolbar">
			<a routerLink="/" class="repo" [title]="t().chooseRepo">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<path d="M4 19V5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13" />
				</svg>
				<span>{{ owner() }}/{{ repo() }}</span>
			</a>
			<label class="field">
				<span>{{ t().tags }}</span>
				<input
					type="text"
					[value]="filter()"
					[placeholder]="t().tagsPlaceholder"
					(change)="setFilter($any($event.target).value)"
					(keydown.enter)="setFilter($any($event.target).value)"
				/>
			</label>
			<label class="field">
				<span>{{ t().branches }}</span>
				<select (change)="setBranches($any($event.target).value)">
					<option value="range" [selected]="branchMode() === 'range'">
						{{ t().branchModes.range(data()?.branches?.length ?? 0, data()?.allBranches ?? 0) }}
					</option>
					<option value="default" [selected]="branchMode() === 'default'">
						{{ t().branchModes.default }}
					</option>
					<option value="all" [selected]="branchMode() === 'all'">{{ t().branchModes.all }}</option>
				</select>
			</label>
			<button
				type="button"
				class="icon"
				[attr.aria-label]="t().refresh"
				[title]="t().refresh"
				(click)="load()"
				[disabled]="loading()"
			>
				<svg
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
					[class.spin]="loading()"
				>
					<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />
				</svg>
			</button>
		</div>
		@if (error()) {
			<p class="error" role="alert">
				{{ error() }} <button type="button" class="link" (click)="load()">{{ t().retry }}</button>
			</p>
		}
		@if (data(); as d) {
			<div class="layout">
				<section class="timeline card" [attr.aria-label]="d.owner + '/' + d.name">
					<div class="range muted small">
						<span>{{ d.releaseTags.length ? t().rangeFrom(oldestTag()) : t().rangeRecent }}</span>
						<span>{{ t().commits(d.total) }}</span>
					</div>
					<div class="graph" [style.--row.px]="geo().row">
						<svg class="lines" [attr.width]="graphWidth()" [attr.height]="height()" aria-hidden="true">
							@for (e of edges(); track $index) {
								<path
									[attr.d]="e.d"
									[attr.class]="
										'edge lane-' + e.lane + (e.open ? ' fade' : '') + (e.gap ? ' gap' : '')
									"
								/>
							}
							@for (n of d.graph.nodes; track n.commit.oid) {
								@if (!n.commit.gap) {
									<circle
										[attr.cx]="geo().pad + n.lane * geo().lane"
										[attr.cy]="n.row * geo().row + geo().row / 2"
										r="5.5"
										[attr.class]="
											'dot lane-' +
											(n.lane % lanes) +
											(tagged().has(n.commit.oid) ? ' filled' : '')
										"
									/>
								}
							}
						</svg>
						@for (row of rows(); track row.commit.oid) {
							@if (row.commit.gap; as gap) {
								<div class="row gap" [style.padding-left.px]="graphWidth() + 8">
									<span class="muted small">{{ t().hiddenCommits(gap.count) }}</span>
									<button
										type="button"
										class="link small"
										[disabled]="expanding() === row.commit.oid"
										(click)="expand(row.commit.oid)"
									>
										@if (expanding() === row.commit.oid) {
											<span class="spinner" aria-hidden="true"></span>
										}
										{{ gap.count > expandStep ? t().showSome(expandStep) : t().showHidden }}
									</button>
								</div>
							} @else {
								<div
									class="row"
									[class.drop]="dropOid() === row.commit.oid"
									[class.merge]="row.merge"
									[style.padding-left.px]="graphWidth() + 8"
									tabindex="0"
									role="button"
									[attr.aria-label]="row.commit.short + ' ' + row.commit.message"
									(click)="openPicker(row.commit)"
									(keydown.enter)="openPicker(row.commit)"
									(dragover)="dragOver($event, row.commit)"
									(dragleave)="dropOid.set(null)"
									(drop)="drop($event, row.commit)"
								>
									<code class="sha">{{ row.commit.short }}</code>
									<span class="msg">{{ row.commit.message }}</span>
									<span class="refs">
										@for (ref of row.refs; track ref.kind + ref.name) {
											@switch (ref.kind) {
												@case ("release") {
													<span
														class="tag release"
														[class.movable]="d.canPush"
														[style.background]="ref.color"
														[style.color]="ref.text"
														[attr.draggable]="d.canPush"
														(dragstart)="dragStart($event, ref.name)"
														(dragend)="dragEnd()"
														(click)="$event.stopPropagation(); openPicker(row.commit)"
													>
														@if (d.canPush) {
															<svg
																width="8"
																height="12"
																viewBox="0 0 10 14"
																aria-hidden="true"
															>
																<g fill="currentColor">
																	<circle cx="2.5" cy="2.5" r="1.3" />
																	<circle cx="7.5" cy="2.5" r="1.3" />
																	<circle cx="2.5" cy="7" r="1.3" />
																	<circle cx="7.5" cy="7" r="1.3" />
																	<circle cx="2.5" cy="11.5" r="1.3" />
																	<circle cx="7.5" cy="11.5" r="1.3" />
																</g>
															</svg>
														}
														{{ ref.name }}
													</span>
												}
												@case ("pending") {
													<a
														class="tag pending"
														[style.border-color]="ref.color"
														[style.color]="ref.color"
														[attr.href]="ref.url"
														target="_blank"
														rel="noopener"
														[title]="t().viewRun"
														(click)="$event.stopPropagation()"
														><span class="spinner" aria-hidden="true"></span
														>{{ ref.name }} · {{ t().pending }}</a
													>
												}
												@case ("version") {
													<span class="tag version">{{ ref.name }}</span>
												}
												@case ("branch") {
													<span [attr.class]="'tag branch lane-' + ref.lane">
														<svg
															width="12"
															height="12"
															viewBox="0 0 24 24"
															fill="none"
															stroke="currentColor"
															stroke-width="2.4"
															aria-hidden="true"
														>
															<circle cx="6" cy="5" r="2.5" />
															<circle cx="6" cy="19" r="2.5" />
															<circle cx="18" cy="7" r="2.5" />
															<path d="M6 7.5v9M18 9.5a6 6 0 0 1-6 6H8" />
														</svg>
														{{ ref.name }}
													</span>
												}
											}
										}
									</span>
									<span class="meta muted small"
										>{{ row.commit.author }} · {{ ago(row.commit.date) }}</span
									>
								</div>
							}
						}
					</div>
				</section>
				<aside>
					<h2 class="aside-title">{{ t().releaseTags }}</h2>
					@for (card of cards(); track card.name) {
						<section class="card release-card">
							<div class="card-head">
								<span class="tag" [style.background]="card.color" [style.color]="card.text">{{
									card.name
								}}</span>
								<code class="muted">{{ card.short }}</code>
								<span class="muted small">{{ card.position }}</span>
							</div>
							<div class="small wf-line">
								<svg
									viewBox="0 0 24 24"
									width="14"
									height="14"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									aria-hidden="true"
								>
									<circle cx="12" cy="12" r="9" />
									<path d="M10 8l6 4-6 4z" fill="currentColor" />
								</svg>
								@if (card.workflow) {
									<span
										>{{ card.workflow }} <span class="muted">{{ card.file }}</span></span
									>
								} @else {
									<span class="muted">{{ t().noWorkflow }}</span>
								}
							</div>
							@if (card.pending) {
								<a
									class="small status running"
									[attr.href]="card.pending"
									target="_blank"
									rel="noopener"
									><span class="spinner" aria-hidden="true"></span>{{ t().pending }}</a
								>
							} @else if (card.run) {
								<a
									[class]="'small status ' + card.runState"
									[href]="card.run.url"
									target="_blank"
									rel="noopener"
								>
									{{ t().lastRun[card.runState] }} · {{ ago(card.run.createdAt) }}
								</a>
							} @else if (card.workflow) {
								<span class="small muted">{{ t().lastRun.none }}</span>
							}
						</section>
					} @empty {
						<p class="card muted small">{{ t().noReleaseTags }}</p>
					}
					<p class="muted small hint">{{ d.canPush ? t().dragHint : t().readOnly }}</p>
					<a [routerLink]="['/', owner(), repo(), 'workflows']" class="small">{{ t().tagWorkflows }}…</a>
				</aside>
			</div>
		} @else if (loading()) {
			<p class="muted">{{ t().loading }}</p>
		}

		<dialog #picker class="picker" (close)="pickFor.set(null)" aria-labelledby="picker-title">
			@if (pickFor(); as c) {
				<div class="picker-body">
					<div>
						<code class="muted">{{ c.short }} · {{ c.author }} · {{ ago(c.date) }}</code>
						<h2 id="picker-title">{{ c.message }}</h2>
					</div>
					@if (data()?.canPush && pickerTags().length) {
						<span class="muted small">{{ t().releaseHere }}</span>
						<div class="choices">
							@for (choice of pickerTags(); track choice.name) {
								<button
									type="button"
									class="choice"
									[style.background]="choice.here ? 'transparent' : choice.color"
									[style.color]="choice.here ? 'var(--muted)' : choice.text"
									[class.here]="choice.here"
									[disabled]="choice.here"
									(click)="release(choice.name, c)"
								>
									<span>{{ choice.name }}</span>
									<span class="small">{{ choice.note }}</span>
								</button>
							}
						</div>
					} @else if (data()?.canPush) {
						<p class="muted small">{{ t().noReleaseTags }}</p>
					}
					<div class="picker-actions">
						<a [href]="c.url" target="_blank" rel="noopener" class="small">{{ t().openOnGithub }}</a>
						<button type="button" (click)="pickFor.set(null)">{{ t().cancel }}</button>
					</div>
				</div>
			}
		</dialog>

		@if (data(); as d) {
			@if (workflows(); as w) {
				<app-release-dialog
					[data]="d"
					[workflows]="w"
					[picks]="picks()"
					[request]="request()"
					(closed)="released($event)"
				/>
			}
		}
	`,
	styleUrl: "./timeline.css",
})
export class Timeline {
	private readonly github = inject(Github);
	private readonly store = inject(Store);
	protected readonly i18n = inject(I18n);
	protected readonly t = this.i18n.t;
	readonly owner = input.required<string>();
	readonly repo = input.required<string>();
	protected readonly lanes = LANES;

	protected readonly data = signal<RepoData | null>(null);
	protected readonly workflows = signal<WorkflowSet | null>(null);
	protected readonly runs = signal<Record<string, Run | null>>({});
	protected readonly loading = signal(false);
	protected readonly error = signal<string | null>(null);
	protected readonly filter = signal("");
	protected readonly branchMode = signal<BranchMode>("range");
	protected readonly picks = signal<Record<string, string>>({});
	protected readonly dragTag = signal<string | null>(null);
	protected readonly dropOid = signal<string | null>(null);
	protected readonly pickFor = signal<Commit | null>(null);
	protected readonly request = signal<ReleaseRequest | null>(null);
	protected readonly narrow = signal(matchMedia("(max-width: 700px)").matches);
	protected readonly picker = viewChild.required<ElementRef<HTMLDialogElement>>("picker");
	private readonly now = signal(Date.now());
	private loadId = 0;
	protected readonly expanding = signal<string | null>(null);
	protected readonly expandStep = EXPAND_DEPTH;

	protected readonly full = computed(() => `${this.owner()}/${this.repo()}`);
	protected readonly geo = computed(() =>
		this.narrow() ? { row: 60, lane: 14, pad: 14 } : { row: 44, lane: 18, pad: 16 },
	);
	protected readonly graphWidth = computed(() => {
		const lanes = this.data()?.graph.lanes ?? 1;
		return this.geo().pad * 2 + (lanes - 1) * this.geo().lane;
	});
	protected readonly height = computed(() => (this.data()?.commits.length ?? 0) * this.geo().row);

	protected readonly edges = computed(() => {
		const d = this.data();
		if (!d) return [];
		const geo = this.geo();
		const bottom = this.height();
		return d.graph.edges.map((e) => ({
			d: edgePath(e, geo, bottom),
			lane: e.lane % LANES,
			open: e.toRow === null,
			gap: !!d.commits[e.fromRow]?.gap || (e.toRow !== null && !!d.commits[e.toRow]?.gap),
		}));
	});

	protected readonly matches = computed(() => {
		const d = this.data();
		const w = this.workflows();
		const out: Record<string, ReturnType<typeof matchWorkflow>> = {};
		if (!d) return out;
		for (const tag of d.releaseTags)
			out[tag] = w ? matchWorkflow(tag, w.workflows, w.config, this.picks()[tag]) : null;
		return out;
	});

	protected readonly colors = computed(() => {
		const out: Record<string, { color: string; text: string }> = {};
		for (const tag of this.data()?.releaseTags ?? []) {
			const color = tagColor(tag, this.matches()[tag]?.color ?? this.workflows()?.config[tag]?.color);
			out[tag] = { color, text: readableText(color) };
		}
		return out;
	});

	protected readonly pendingHere = computed(() => this.store.pending().filter((p) => p.repo === this.full()));

	protected readonly tagged = computed(() => {
		const d = this.data();
		return new Set(d ? d.tags.filter((t) => d.releaseTags.includes(t.name)).map((t) => t.oid) : []);
	});

	protected readonly rows = computed(() => {
		const d = this.data();
		if (!d) return [];
		const shown = new Set(d.shownTags);
		const release = new Set(d.releaseTags);
		const refs = new Map<string, RowRef[]>();
		const add = (oid: string, ref: RowRef) => refs.set(oid, [...(refs.get(oid) ?? []), ref]);
		for (const tag of d.tags) {
			if (release.has(tag.name)) add(tag.oid, { name: tag.name, kind: "release", ...this.colorOf(tag.name) });
		}
		for (const p of this.pendingHere()) {
			add(p.sha, { name: p.tag, kind: "pending", color: this.colorOf(p.tag).color, url: p.url });
		}
		for (const tag of d.tags) {
			if (!release.has(tag.name) && shown.has(tag.name) && isVersionTag(tag.name))
				add(tag.oid, { name: tag.name, kind: "version" });
		}
		for (const tag of d.tags) {
			if (!release.has(tag.name) && shown.has(tag.name) && !isVersionTag(tag.name))
				add(tag.oid, { name: tag.name, kind: "version" });
		}
		const laneOf = new Map(d.graph.nodes.map((n) => [n.commit.oid, n.lane]));
		for (const b of d.branches)
			add(b.oid, { name: b.name, kind: "branch", lane: (laneOf.get(b.oid) ?? 0) % LANES });
		return d.commits.map((commit) => ({
			commit,
			refs: refs.get(commit.oid) ?? [],
			merge: commit.parents.length > 1,
		}));
	});

	protected readonly oldestTag = computed(() => {
		const d = this.data();
		if (!d) return "";
		const tags = d.tags.filter((t) => d.releaseTags.includes(t.name));
		return tags.reduce((a, b) => (a.date <= b.date ? a : b), tags[0])?.name ?? "";
	});

	protected readonly cards = computed(() => {
		const d = this.data();
		if (!d) return [];
		const head = d.branches.find((b) => b.name === d.defaultBranch)?.oid;
		return d.releaseTags.map((name) => {
			const tag = d.tags.find((t) => t.name === name)!;
			const match = this.matches()[name];
			const run = this.runs()[name] ?? null;
			const inView = d.commits.some((c) => c.oid === tag.oid);
			const behind = d.behind[name] ?? (head && inView ? countBetween(d.commits, head, tag.oid) : 0);
			const pending = this.pendingHere().find((p) => p.tag === name);
			return {
				name,
				...this.colorOf(name),
				short: tag.oid.slice(0, 7),
				position:
					tag.oid === head
						? this.t().atNewest
						: !inView
							? this.t().notInView
							: behind
								? this.t().behind(behind)
								: "",
				workflow: match?.workflow.name ?? null,
				file: match?.workflow.path.split("/").pop() ?? "",
				run,
				runState: !run
					? "none"
					: run.status !== "completed"
						? "running"
						: run.conclusion === "success"
							? "success"
							: run.conclusion === "failure"
								? "failure"
								: "other",
				pending: pending ? (pending.url ?? "#") : null,
			} as const;
		});
	});

	protected readonly pickerTags = computed(() => {
		const c = this.pickFor();
		const d = this.data();
		if (!c || !d) return [];
		return d.releaseTags.map((name) => {
			const tag = d.tags.find((t) => t.name === name)!;
			const here = tag.oid === c.oid;
			const back = countBetween(d.commits, tag.oid, c.oid);
			const forward = back ? 0 : countBetween(d.commits, c.oid, tag.oid);
			const t = this.t();
			return {
				name,
				here,
				...this.colorOf(name),
				note: here ? t.alreadyHere : back ? t.moveBack(back) : forward ? t.moveForward(forward) : "",
			};
		});
	});

	constructor() {
		const media = matchMedia("(max-width: 700px)");
		const onMedia = () => this.narrow.set(media.matches);
		media.addEventListener("change", onMedia);
		const tick = setInterval(() => this.now.set(Date.now()), 60_000);
		inject(DestroyRef).onDestroy(() => {
			media.removeEventListener("change", onMedia);
			clearInterval(tick);
		});

		effect(() => {
			const full = this.full();
			untracked(() => {
				const s = this.store.settings(full);
				this.filter.set(s.filter);
				this.branchMode.set(s.branches);
				this.picks.set(s.picks);
				this.data.set(null);
				this.workflows.set(null);
				this.runs.set({});
				this.store.visit(full);
				this.load();
			});
		});

		effect(() => {
			const done = this.store.finished();
			if (done && done.repo === untracked(this.full)) untracked(() => this.load());
		});

		effect(() => {
			const c = this.pickFor();
			const el = this.picker().nativeElement;
			if (c && !el.open) el.showModal();
			if (!c && el.open) el.close();
		});
	}

	private colorOf(tag: string) {
		return this.colors()[tag] ?? { color: tagColor(tag), text: readableText(tagColor(tag)) };
	}

	async load() {
		const id = ++this.loadId;
		const owner = this.owner();
		const repo = this.repo();
		this.loading.set(true);
		this.error.set(null);
		try {
			const workflows = await this.github
				.workflows(owner, repo)
				.catch((): WorkflowSet => ({ workflows: [], config: {}, hasConfig: false }));
			const data = await this.github.load(owner, repo, parseFilter(this.filter()), this.branchMode(), (names) =>
				autoReleaseTags(names, workflows, this.picks()),
			);
			if (id !== this.loadId) return;
			this.data.set(data);
			this.workflows.set(workflows);
			this.loadRuns(id);
		} catch (e) {
			if (id !== this.loadId) return;
			this.error.set(this.t().errors[e instanceof GithubFailure ? e.kind : "failed"]);
		} finally {
			if (id === this.loadId) this.loading.set(false);
		}
	}

	protected async expand(oid: string) {
		const d = this.data();
		if (!d || this.expanding()) return;
		const id = this.loadId;
		this.expanding.set(oid);
		try {
			const next = await this.github.expand(d, oid);
			if (id === this.loadId) this.data.set(next);
		} catch (e) {
			if (id === this.loadId) this.error.set(this.t().errors[e instanceof GithubFailure ? e.kind : "failed"]);
		} finally {
			this.expanding.set(null);
		}
	}

	private async loadRuns(id: number) {
		const entries = Object.entries(this.matches()).filter(([, m]) => !!m);
		const results = await Promise.all(
			entries.map(
				async ([tag, m]) =>
					[
						tag,
						await this.github.lastRun(this.owner(), this.repo(), m!.workflow.id).catch(() => null),
					] as const,
			),
		);
		if (id === this.loadId) this.runs.set(Object.fromEntries(results));
	}

	private save() {
		this.store.saveSettings(this.full(), {
			filter: this.filter(),
			branches: this.branchMode(),
			picks: this.picks(),
		});
	}

	protected setFilter(value: string) {
		if (value.trim() === this.filter()) return;
		this.filter.set(value.trim());
		this.save();
		this.load();
	}

	protected setBranches(value: BranchMode) {
		this.branchMode.set(value);
		this.save();
		this.load();
	}

	protected ago(iso: string): string {
		const diff = (new Date(iso).getTime() - this.now()) / 1000;
		const rtf = new Intl.RelativeTimeFormat(this.i18n.locale(), { numeric: "auto" });
		const abs = Math.abs(diff);
		if (abs < 60) return rtf.format(Math.round(diff), "second");
		if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
		if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
		if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
		return new Date(iso).toLocaleDateString(this.i18n.locale(), {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	}

	protected dragStart(event: DragEvent, tag: string) {
		this.dragTag.set(tag);
		event.dataTransfer?.setData("text/plain", tag);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
	}

	protected dragEnd() {
		this.dragTag.set(null);
		this.dropOid.set(null);
	}

	protected dragOver(event: DragEvent, commit: Commit) {
		if (!this.dragTag()) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
		this.dropOid.set(commit.oid);
	}

	protected drop(event: DragEvent, commit: Commit) {
		const tag = this.dragTag();
		this.dragEnd();
		if (!tag) return;
		event.preventDefault();
		const current = this.data()?.tags.find((t) => t.name === tag);
		if (current?.oid === commit.oid) return;
		this.request.set({ tag, commit });
	}

	protected openPicker(commit: Commit) {
		this.pickFor.set(commit);
	}

	protected release(tag: string, commit: Commit) {
		this.pickFor.set(null);
		this.request.set({ tag, commit });
	}

	protected released(done: boolean) {
		this.request.set(null);
		if (done) {
			this.load();
			this.store.watch();
		}
	}
}
