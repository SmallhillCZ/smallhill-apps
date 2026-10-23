import { Component, computed, effect, inject, input, signal, untracked } from "@angular/core";
import { RouterLink } from "@angular/router";
import { parseFilter, readableText, tagColor } from "../core/tags";
import { autoReleaseTags, isBumpInput, matchWorkflow } from "../core/workflows";
import { Github, GithubFailure, type RepoData, type WorkflowSet } from "../github";
import { I18n } from "../i18n";
import { Store } from "../store";

const EXAMPLE = `tags:
  PRODUCTION:
    workflow: release-production.yml
    color: "#2b8a3e"
    inputs:
      semver: patch
  NEXT:
    workflow: release-next.yml
  STAGING:
    workflow: release.yml
    inputs:
      environment: staging`;

@Component({
	selector: "app-workflows-page",
	imports: [RouterLink],
	template: `
		<div class="head">
			<a
				[routerLink]="['/', owner(), repo()]"
				class="button icon"
				[attr.aria-label]="t().back"
				[title]="t().back"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
					<path d="M15 6l-6 6 6 6" />
				</svg>
			</a>
			<h1>{{ t().workflowsTitle }}</h1>
			<span class="muted">{{ owner() }}/{{ repo() }}</span>
		</div>
		@if (error()) {
			<p class="error" role="alert">{{ error() }}</p>
		}
		@if (rows(); as list) {
			<div class="card table">
				<div class="tr th">
					<span>{{ t().tagCol }}</span
					><span>{{ t().workflowCol }}</span
					><span>{{ t().inputsCol }}</span
					><span>{{ t().matchedCol }}</span>
				</div>
				@for (row of list; track row.tag) {
					<div class="tr">
						<span
							><span class="tag" [style.background]="row.color" [style.color]="row.text">{{
								row.tag
							}}</span></span
						>
						<select
							[attr.aria-label]="t().workflowCol + ' ' + row.tag"
							[disabled]="row.source === 'config'"
							(change)="pick(row.tag, $any($event.target).value)"
						>
							<option value="" [selected]="!picks()[row.tag]">
								{{ t().automatic }}{{ row.auto ? ": " + row.auto : "" }}
							</option>
							@for (w of dispatchable(); track w.id) {
								<option [value]="w.path" [selected]="picks()[row.tag] === w.path">
									{{ w.name }} · {{ file(w.path) }}
								</option>
							}
						</select>
						<span class="inputs small">
							@for (i of row.inputs; track i) {
								<code>{{ i }}</code>
							} @empty {
								<span class="muted">{{ t().none }}</span>
							}
						</span>
						<span>
							@if (row.source) {
								<span class="chip">{{ t().matched[row.source] }}</span>
							}
						</span>
					</div>
				}
				<div class="tr">
					<span><span class="tag version">v*</span></span>
					<span class="muted small wide">{{ t().versionRow }}</span>
					<span
						><span class="chip">{{ t().versionTag }}</span></span
					>
				</div>
			</div>
		} @else if (!error()) {
			<p class="muted">{{ t().loading }}</p>
		}
		<div class="cols">
			<section class="card">
				<h2>{{ t().howTitle }}</h2>
				<ol>
					@for (rule of t().rules; track $index) {
						<li>
							<strong>{{ rule[0] }}</strong> {{ rule[1] }}
							@if ($index === 0) {
								<code>.github/release-line.yml</code>
							}
						</li>
					}
				</ol>
				<p class="muted small">{{ t().inputsNote }}</p>
			</section>
			<section class="card">
				<h2>{{ t().configTitle }}</h2>
				<pre>{{ example }}</pre>
				<p class="muted small">{{ t().configNote }}</p>
			</section>
		</div>
		<section class="card">
			<h2>{{ t().refTitle }}</h2>
			<p class="small">{{ t().refText }}</p>
		</section>
	`,
	styles: `
		:host {
			display: flex;
			flex-direction: column;
			gap: 1rem;
			max-width: 1040px;
		}
		.head {
			display: flex;
			align-items: center;
			flex-wrap: wrap;
			gap: 0.75rem;
		}
		.head h1 {
			margin: 0;
		}
		.button.icon {
			width: 40px;
			padding: 0;
		}
		.button.icon svg {
			width: 18px;
			height: 18px;
		}
		.table {
			padding: 0;
			overflow: hidden;
		}
		.tr {
			display: grid;
			grid-template-columns: 150px minmax(0, 1fr) 200px 120px;
			gap: 0.75rem;
			align-items: center;
			padding: 0.8rem 1rem;
			border-bottom: 1px solid var(--border);
		}
		.tr:last-child {
			border-bottom: 0;
		}
		.th {
			background: var(--surface-2);
			color: var(--muted);
			font-size: 0.75rem;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			padding: 0.6rem 1rem;
		}
		.tr select {
			min-width: 0;
		}
		.wide {
			grid-column: span 2;
		}
		.inputs {
			display: flex;
			flex-wrap: wrap;
			gap: 0.3rem;
		}
		.cols {
			display: flex;
			flex-wrap: wrap;
			gap: 1rem;
		}
		.cols > .card {
			flex: 1 1 360px;
		}
		ol {
			padding-left: 1.2rem;
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
		}
		pre {
			margin: 0 0 0.75rem;
			background: #1d2129;
			color: #e9ecef;
			border-radius: 10px;
			padding: 0.9rem 1rem;
			font-family: var(--mono);
			font-size: 0.8rem;
			line-height: 1.6;
			overflow-x: auto;
		}
		section p:last-child {
			margin: 0;
		}
		@media (max-width: 700px) {
			.tr {
				grid-template-columns: 1fr 1fr;
			}
			.th {
				display: none;
			}
		}
	`,
})
export class WorkflowsPage {
	private readonly github = inject(Github);
	private readonly store = inject(Store);
	protected readonly t = inject(I18n).t;
	readonly owner = input.required<string>();
	readonly repo = input.required<string>();
	protected readonly example = EXAMPLE;
	protected readonly data = signal<RepoData | null>(null);
	protected readonly workflows = signal<WorkflowSet | null>(null);
	protected readonly picks = signal<Record<string, string>>({});
	protected readonly error = signal<string | null>(null);
	private readonly full = computed(() => `${this.owner()}/${this.repo()}`);

	protected readonly dispatchable = computed(() => this.workflows()?.workflows.filter((w) => w.dispatchable) ?? []);

	protected readonly rows = computed(() => {
		const d = this.data();
		const w = this.workflows();
		if (!d || !w) return null;
		return d.releaseTags.map((tag) => {
			const match = matchWorkflow(tag, w.workflows, w.config, this.picks()[tag]);
			const auto = matchWorkflow(tag, w.workflows, w.config);
			const color = tagColor(tag, w.config[tag]?.color);
			return {
				tag,
				color,
				text: readableText(color),
				auto: auto ? (auto.workflow.path.split("/").pop() ?? "") : "",
				source: match?.source ?? null,
				inputs: (match?.workflow.inputs ?? []).map((i) =>
					i.type === "choice" && (isBumpInput(i) || i.options.length <= 5)
						? `${i.name}: ${i.options.join("|")}`
						: i.name,
				),
			};
		});
	});

	constructor() {
		effect(() => {
			const full = this.full();
			untracked(() => this.load(full));
		});
	}

	protected file = (path: string) => path.split("/").pop();

	private async load(full: string) {
		const s = this.store.settings(full);
		this.picks.set(s.picks);
		try {
			const workflows = await this.github.workflows(this.owner(), this.repo());
			const data = await this.github.load(this.owner(), this.repo(), parseFilter(s.filter), "default", (names) =>
				autoReleaseTags(names, workflows, s.picks),
			);
			this.data.set(data);
			this.workflows.set(workflows);
		} catch (e) {
			this.error.set(this.t().errors[e instanceof GithubFailure ? e.kind : "failed"]);
		}
	}

	protected pick(tag: string, path: string) {
		const picks = { ...this.picks() };
		if (path) picks[tag] = path;
		else delete picks[tag];
		this.picks.set(picks);
		const s = this.store.settings(this.full());
		this.store.saveSettings(this.full(), { ...s, picks });
	}
}
