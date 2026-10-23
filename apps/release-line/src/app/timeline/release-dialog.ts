import { Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from "@angular/core";
import { Auth } from "../auth";
import { bumpVersion, latestVersion, readableText, tagColor } from "../core/tags";
import {
	type WorkflowInput,
	chooseRef,
	commitInput,
	initialInputs,
	isBumpInput,
	matchWorkflow,
} from "../core/workflows";
import { type Commit, Github, GithubFailure, type RepoData, type WorkflowSet } from "../github";
import { I18n } from "../i18n";
import { Store } from "../store";

export interface ReleaseRequest {
	tag: string;
	commit: Commit;
}

@Component({
	selector: "app-release-dialog",
	template: `
		<dialog #dialog (close)="closed.emit(false)" aria-labelledby="release-title">
			@if (request(); as r) {
				<form class="body" (submit)="submit($event)">
					<div>
						<h2 id="release-title">
							{{ t().releaseTitle }}
							<span class="tag" [style.background]="color()" [style.color]="textColor()">{{
								r.tag
							}}</span>
							{{ t().at }}
							<span
								><code>{{ r.commit.short }}</code
								>?</span
							>
						</h2>
						<p class="muted small subject">{{ r.commit.message }} · {{ r.commit.author }}</p>
					</div>
					@if (back() > 0) {
						<div class="warn">
							<svg
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								aria-hidden="true"
							>
								<path d="M12 3 2 21h20L12 3zM12 10v5M12 18v.01" />
							</svg>
							<span>{{ t().backWarning(r.tag, back()) }}</span>
						</div>
					}
					<div class="grid">
						<label for="wf">{{ t().workflow }}</label>
						<div class="wf">
							<select id="wf" [value]="selectedId()" (change)="pick(+$any($event.target).value)">
								@for (w of dispatchable(); track w.id) {
									<option [value]="w.id" [selected]="w.id === selectedId()">
										{{ w.name }} · {{ file(w.path) }}
									</option>
								}
								<option [value]="0" [selected]="selectedId() === 0">{{ t().justMove }}</option>
							</select>
							@if (match(); as m) {
								@if (m.workflow.id === selectedId()) {
									<span class="chip">{{ t().matched[m.source] }}</span>
								}
							}
						</div>
						@if (workflow(); as w) {
							<span class="label">{{ t().runsOn }}</span>
							<span class="small">{{ runsOn() }}</span>
						}
					</div>
					@if (workflow(); as w) {
						@if (w.inputs.length) {
							<fieldset>
								<legend>{{ t().inputs }}</legend>
								@for (input of w.inputs; track input.name) {
									<div class="input">
										<div class="input-head">
											<label [for]="'in-' + input.name">{{ input.name }}</label>
											@if (input.description) {
												<span class="muted small">{{ input.description }}</span>
											}
										</div>
										@if (isCommit(input)) {
											<input
												type="text"
												[id]="'in-' + input.name"
												[value]="values()[input.name]"
												readonly
											/>
										} @else if (input.type === "choice" && input.options.length <= 5) {
											<div class="segmented" role="radiogroup" [attr.aria-label]="input.name">
												@for (o of input.options; track o) {
													<button
														type="button"
														role="radio"
														[attr.aria-checked]="values()[input.name] === o"
														[class.on]="values()[input.name] === o"
														(click)="set(input.name, o)"
													>
														{{ o }}
													</button>
												}
											</div>
										} @else if (input.type === "choice") {
											<select
												[id]="'in-' + input.name"
												(change)="set(input.name, $any($event.target).value)"
											>
												@for (o of input.options; track o) {
													<option [value]="o" [selected]="values()[input.name] === o">
														{{ o }}
													</option>
												}
											</select>
										} @else if (input.type === "boolean") {
											<label class="switch">
												<input
													type="checkbox"
													[id]="'in-' + input.name"
													[checked]="values()[input.name] === 'true'"
													(change)="
														set(input.name, $any($event.target).checked ? 'true' : 'false')
													"
												/>
												<span>{{ values()[input.name] === "true" ? t().yes : t().no }}</span>
											</label>
										} @else {
											<input
												type="text"
												[id]="'in-' + input.name"
												[value]="values()[input.name]"
												[required]="input.required"
												(input)="set(input.name, $any($event.target).value)"
											/>
										}
										@if (isBump(input)) {
											<span class="muted small"
												>{{ t().newVersion }}:
												<code class="version">{{ nextVersion(values()[input.name]) }}</code>
												@if (latest()) {
													({{ t().latestVersion(latest()!) }})
												}
											</span>
										}
									</div>
								}
							</fieldset>
						}
					}
					<div class="warn">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
							<circle cx="12" cy="12" r="9" />
							<path d="M12 8v5M12 16v.01" />
						</svg>
						<span>{{ t().irreversible }}</span>
					</div>
					<p class="muted small note">{{ workflow() ? t().workflowMoves(r.tag) : t().moveOnly }}</p>
					@if (error()) {
						<p class="error" role="alert">{{ error() }}</p>
					}
					<div class="actions">
						<button type="button" (click)="cancel()">{{ t().cancel }}</button>
						<button type="submit" class="primary" [disabled]="busy()">
							@if (busy()) {
								{{ t().starting }}
							} @else if (workflow()) {
								<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
									<path d="M7 4l13 8-13 8z" fill="currentColor" />
								</svg>
								{{ t().runWorkflow }}
							} @else {
								{{ t().moveTag }}
							}
						</button>
					</div>
				</form>
			}
		</dialog>
	`,
	styles: `
		.body {
			padding: 1.4rem;
			display: flex;
			flex-direction: column;
			gap: 1rem;
		}
		h2 {
			font-size: 1.2rem;
			margin: 0 0 0.3rem;
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.4rem;
		}
		h2 .tag {
			font-size: 14px;
		}
		.subject {
			margin: 0;
		}
		.grid {
			display: grid;
			grid-template-columns: 110px minmax(0, 1fr);
			gap: 0.75rem 0.9rem;
			align-items: center;
		}
		.grid > label,
		.grid > .label {
			color: var(--muted);
			font-weight: 500;
			font-size: 0.9rem;
		}
		.wf {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.5rem;
		}
		.wf {
			min-width: 0;
		}
		.wf select {
			flex: 1 1 220px;
			min-width: 0;
			width: 100%;
		}
		fieldset {
			border: 1px solid var(--border);
			border-radius: var(--radius);
			padding: 0.8rem 1rem 1rem;
			margin: 0;
			display: flex;
			flex-direction: column;
			gap: 1rem;
		}
		legend {
			padding: 0 0.4rem;
			color: var(--muted);
			font-size: 0.85rem;
		}
		.input {
			display: flex;
			flex-direction: column;
			gap: 0.4rem;
		}
		.input-head {
			display: flex;
			flex-direction: column;
		}
		.segmented {
			display: flex;
			border: 1px solid var(--line);
			border-radius: 10px;
			overflow: hidden;
		}
		.segmented button {
			flex: 1;
			border: 0;
			border-radius: 0;
			min-height: 44px;
		}
		.segmented button + button {
			border-left: 1px solid var(--line);
		}
		.segmented button.on {
			background: var(--accent);
			color: var(--accent-text);
		}
		.switch {
			display: inline-flex;
			gap: 0.5rem;
			align-items: center;
			font-weight: 500;
		}
		.switch input {
			width: 20px;
			height: 20px;
			accent-color: var(--accent);
		}
		.version {
			color: var(--text);
			font-weight: 600;
		}
		.note {
			margin: 0;
		}
		.actions {
			display: flex;
			justify-content: flex-end;
			gap: 0.6rem;
		}
		.actions button {
			min-height: 44px;
		}
		@media (max-width: 520px) {
			.grid {
				grid-template-columns: 1fr;
				gap: 0.3rem;
			}
			.grid > span.small {
				margin-bottom: 0.4rem;
			}
		}
	`,
})
export class ReleaseDialog {
	private readonly github = inject(Github);
	private readonly auth = inject(Auth);
	private readonly store = inject(Store);
	protected readonly t = inject(I18n).t;
	readonly data = input.required<RepoData>();
	readonly workflows = input.required<WorkflowSet>();
	readonly picks = input<Record<string, string>>({});
	readonly request = input<ReleaseRequest | null>(null);
	readonly closed = output<boolean>();
	protected readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");
	protected readonly selectedId = signal(0);
	protected readonly values = signal<Record<string, string>>({});
	protected readonly busy = signal(false);
	protected readonly error = signal<string | null>(null);

	protected readonly dispatchable = computed(() => this.workflows().workflows.filter((w) => w.dispatchable));
	protected readonly match = computed(() => {
		const r = this.request();
		if (!r) return null;
		return matchWorkflow(r.tag, this.workflows().workflows, this.workflows().config, this.picks()[r.tag]);
	});
	protected readonly workflow = computed(() => this.dispatchable().find((w) => w.id === this.selectedId()) ?? null);
	protected readonly color = computed(() => tagColor(this.request()?.tag ?? "", this.match()?.color));
	protected readonly textColor = computed(() => readableText(this.color()));
	protected readonly latest = computed(() => latestVersion(this.data().tags.map((t) => t.name)));

	protected readonly back = computed(() => {
		const r = this.request();
		if (!r) return 0;
		const current = this.data().tags.find((t) => t.name === r.tag);
		if (!current || current.oid === r.commit.oid) return 0;
		return countBetween(this.data().commits, current.oid, r.commit.oid);
	});

	protected readonly ref = computed(() => {
		const r = this.request();
		const w = this.workflow();
		if (!r || !w) return null;
		const data = this.data();
		const branchesAt = data.branches.filter((b) => b.oid === r.commit.oid).map((b) => b.name);
		const tagsAt = data.tags.filter((t) => t.oid === r.commit.oid && t.name !== r.tag).map((t) => t.name);
		return chooseRef(w, r.commit.oid, data.defaultBranch, branchesAt, tagsAt);
	});

	protected readonly runsOn = computed(() => {
		const ref = this.ref();
		const w = this.workflow();
		if (!ref || !w) return "";
		const t = this.t();
		if (ref.kind === "input") return t.runsOnInput(ref.ref, commitInput(w)!.name);
		if (ref.kind === "branch") return t.runsOnBranch(ref.ref);
		if (ref.kind === "tag") return t.runsOnTag(ref.ref);
		return t.runsOnTemp(ref.ref);
	});

	constructor() {
		effect(() => {
			const r = this.request();
			const el = this.dialog().nativeElement;
			if (r) {
				this.error.set(null);
				this.busy.set(false);
				this.pick(this.match()?.workflow.id ?? 0);
				if (!el.open) el.showModal();
			} else if (el.open) el.close();
		});
	}

	protected file = (path: string) => path.split("/").pop();
	protected isCommit = (input: WorkflowInput) => this.workflow() && commitInput(this.workflow()!) === input;
	protected isBump = isBumpInput;
	protected nextVersion = (bump: string) =>
		bumpVersion(this.latest(), bump) === this.latest()
			? `${this.latest() ?? "v0.0.0"} (${this.t().noBump})`
			: bumpVersion(this.latest(), bump);

	protected pick(id: number) {
		this.selectedId.set(id);
		const w = this.dispatchable().find((x) => x.id === id);
		const r = this.request();
		const preset = this.match()?.workflow.id === id ? (this.match()?.inputs ?? {}) : {};
		this.values.set(w && r ? initialInputs(w, preset, r.commit.oid) : {});
	}

	protected cancel() {
		this.dialog().nativeElement.close();
	}

	protected set(name: string, value: string) {
		this.values.update((v) => ({ ...v, [name]: value }));
	}

	protected async submit(event: Event) {
		event.preventDefault();
		const r = this.request();
		if (!r || this.busy()) return;
		const { owner, name } = this.data();
		this.busy.set(true);
		this.error.set(null);
		const w = this.workflow();
		const ref = this.ref();
		let temp: string | null = null;
		try {
			if (!w || !ref) {
				await this.github.moveTag(owner, name, r.tag, r.commit.oid);
			} else {
				if (ref.kind === "temporary") {
					await this.github.createBranch(owner, name, ref.ref, r.commit.oid);
					temp = ref.ref;
				}
				const dispatchedAt = new Date().toISOString();
				const run = await this.github.dispatch(owner, name, w.id, ref.ref, this.values());
				const actor = (await this.github.user().catch(() => null))?.login ?? "";
				this.store.addPending({
					repo: `${owner}/${name}`,
					tag: r.tag,
					sha: r.commit.oid,
					workflowId: w.id,
					dispatchedAt,
					actor,
					runId: run.runId,
					url: run.url,
					tempBranch: temp,
				});
			}
			this.closed.emit(true);
		} catch (e) {
			if (temp) await this.github.deleteBranch(owner, name, temp);
			const kind = e instanceof GithubFailure ? e.kind : "failed";
			this.error.set(kind === "workflow" && w ? this.t().workflowRefused : this.t().errors[kind]);
			this.busy.set(false);
		}
	}
}

export function countBetween(commits: Commit[], newer: string, older: string): number {
	const byOid = new Map(commits.map((c) => [c.oid, c]));
	const reach = (from: string) => {
		const seen = new Set<string>();
		const stack = [from];
		while (stack.length) {
			const oid = stack.pop()!;
			if (seen.has(oid) || !byOid.has(oid)) continue;
			seen.add(oid);
			stack.push(...byOid.get(oid)!.parents);
		}
		return seen;
	};
	const fromNewer = reach(newer);
	if (!fromNewer.has(older)) return 0;
	const fromOlder = reach(older);
	let n = 0;
	for (const oid of fromNewer) if (!fromOlder.has(oid)) n += byOid.get(oid)!.gap?.count ?? 1;
	return n;
}
