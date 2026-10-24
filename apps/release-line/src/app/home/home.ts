import { Component, OnDestroy, computed, effect, inject, signal } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { Auth, AuthFailure, type DeviceCode } from "../auth";
import { Github, GithubFailure, type RepoSummary } from "../github";
import { I18n } from "../i18n";
import { Store } from "../store";

const NEXT_PATTERN = /^\/[\w.-]+\/[\w.-]+(\/workflows)?$/;
const GITHUB_MARK =
	"M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z";

@Component({
	selector: "app-home",
	imports: [RouterLink],
	template: `
		@if (!auth.signedIn()) {
			<section class="card signin">
				<div class="intro">
					<img src="icon.svg" alt="" width="44" height="44" />
					<div>
						<h1>{{ t().appName }}</h1>
						<p class="muted">{{ t().tagline }}</p>
					</div>
				</div>
				@if (error()) {
					<p class="error" role="alert">{{ error() }}</p>
				}
				@if (auth.webFlow()) {
					<button type="button" class="primary big" [disabled]="busy()" (click)="auth.startWeb(next())">
						<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="currentColor">
							<path [attr.d]="githubMark" />
						</svg>
						{{ t().signInGithub }}
					</button>
					<div class="or"><span></span>{{ t().or }}<span></span></div>
				} @else if (auth.deviceFlow()) {
					@if (code(); as c) {
						<div class="code">
							<span class="muted small">{{ t().enterCode }}</span>
							<div class="code-row">
								<code class="user-code">{{ c.userCode }}</code>
								<button
									type="button"
									class="icon"
									[attr.aria-label]="t().copyCode"
									[title]="copied() ? t().copied : t().copyCode"
									(click)="copy(c.userCode)"
								>
									@if (copied()) {
										<svg
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2.4"
											aria-hidden="true"
										>
											<path d="M5 12l5 5L20 7" />
										</svg>
									} @else {
										<svg
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											aria-hidden="true"
										>
											<rect x="9" y="9" width="11" height="11" rx="2" />
											<path d="M5 15V6a2 2 0 0 1 2-2h9" />
										</svg>
									}
								</button>
							</div>
							<a
								class="button primary"
								[href]="c.verificationUri"
								target="_blank"
								rel="noopener"
								(click)="copy(c.userCode)"
								>{{ t().openGithub }}</a
							>
							<span class="muted small waiting"
								><span class="spinner" aria-hidden="true"></span>{{ t().waiting }}</span
							>
						</div>
					} @else {
						<button type="button" class="primary big" [disabled]="busy()" (click)="startDevice()">
							<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="currentColor">
								<path
									d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
								/>
							</svg>
							{{ t().signInGithub }}
						</button>
					}
					<div class="or"><span></span>{{ t().or }}<span></span></div>
				}
				<form class="pat" (submit)="useToken($event)">
					<label for="pat">{{ t().patLabel }}</label>
					<div class="pat-row">
						<input
							id="pat"
							name="pat"
							type="password"
							autocomplete="off"
							placeholder="github_pat_…"
							required
						/>
						<button type="submit" [disabled]="busy()">{{ t().patUse }}</button>
					</div>
					<span class="muted small"
						>{{ t().patHint }}
						<a
							href="https://github.com/settings/personal-access-tokens/new"
							target="_blank"
							rel="noopener"
							>{{ t().createToken }}</a
						></span
					>
				</form>
				<p class="muted small privacy">{{ t().privacy }}</p>
			</section>
		} @else {
			<section class="repos">
				<h1>{{ t().chooseRepo }}</h1>
				<form class="search" (submit)="openTyped($event)">
					<input
						type="search"
						name="q"
						[placeholder]="t().searchRepos"
						[attr.aria-label]="t().searchRepos"
						[value]="query()"
						(input)="query.set($any($event.target).value)"
						autocomplete="off"
					/>
					<button type="submit" class="primary">{{ t().open }}</button>
				</form>
				@if (error()) {
					<p class="error" role="alert">{{ error() }}</p>
				}
				@if (recent().length) {
					<h2>{{ t().recent }}</h2>
					<ul class="list">
						@for (r of recent(); track r) {
							<li>
								<a [routerLink]="['/', owner(r), name(r)]" class="row">{{ r }}</a>
							</li>
						}
					</ul>
				}
				<h2>{{ t().yourRepos }}</h2>
				@if (repos() === null) {
					<p class="muted">{{ t().loading }}</p>
				} @else {
					<ul class="list">
						@for (r of filtered(); track r.fullName) {
							<li>
								<a [routerLink]="['/', owner(r.fullName), name(r.fullName)]" class="row">
									<span class="repo-name">{{ r.fullName }}</span>
									@if (r.private) {
										<span class="chip">{{ t().private }}</span>
									}
									@if (r.description) {
										<span class="muted small desc">{{ r.description }}</span>
									}
								</a>
							</li>
						} @empty {
							<li class="muted">{{ t().noRepos }}</li>
						}
					</ul>
				}
			</section>
		}
	`,
	styles: `
		.signin {
			max-width: 460px;
			margin: 2rem auto;
			display: flex;
			flex-direction: column;
			gap: 1.1rem;
		}
		.intro {
			display: flex;
			gap: 0.9rem;
			align-items: center;
		}
		.intro h1 {
			margin: 0;
		}
		.intro p {
			margin: 0;
		}
		.big {
			min-height: 48px;
			font-size: 1rem;
		}
		.code {
			background: var(--surface-2);
			border-radius: var(--radius);
			padding: 1.1rem;
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 0.75rem;
			text-align: center;
		}
		.code-row {
			display: flex;
			align-items: center;
			gap: 0.6rem;
		}
		.user-code {
			font-size: 1.9rem;
			font-weight: 600;
			letter-spacing: 0.08em;
		}
		.waiting {
			display: inline-flex;
			gap: 0.4rem;
			align-items: center;
		}
		.spinner {
			width: 14px;
			height: 14px;
			border: 2px solid currentColor;
			border-right-color: transparent;
			border-radius: 50%;
			animation: spin 0.9s linear infinite;
		}
		@keyframes spin {
			to {
				transform: rotate(360deg);
			}
		}
		.or {
			display: flex;
			align-items: center;
			gap: 0.6rem;
			color: var(--muted);
			font-size: 0.85rem;
		}
		.or span {
			flex: 1;
			height: 1px;
			background: var(--border);
		}
		.pat {
			display: flex;
			flex-direction: column;
			gap: 0.4rem;
		}
		.pat-row {
			display: flex;
			gap: 0.5rem;
		}
		.pat-row input {
			flex: 1;
			min-width: 0;
		}
		.privacy {
			margin: 0;
		}
		.repos {
			max-width: 720px;
			margin: 1rem auto;
		}
		.search {
			display: flex;
			gap: 0.5rem;
			margin: 1rem 0 1.5rem;
		}
		.search input {
			flex: 1;
			min-width: 0;
		}
		.list {
			list-style: none;
			padding: 0;
			margin: 0 0 1.5rem;
			background: var(--surface);
			border: 1px solid var(--border);
			border-radius: var(--radius);
			overflow: hidden;
		}
		.list li + li {
			border-top: 1px solid var(--border);
		}
		.list li.muted {
			padding: 0.9rem 1rem;
		}
		.row {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.3rem 0.6rem;
			padding: 0.75rem 1rem;
			min-height: 48px;
			color: var(--text);
			text-decoration: none;
		}
		.row:hover {
			background: var(--surface-2);
		}
		.repo-name {
			font-weight: 600;
		}
		.desc {
			flex-basis: 100%;
		}
	`,
})
export class Home implements OnDestroy {
	protected readonly auth = inject(Auth);
	private readonly github = inject(Github);
	private readonly store = inject(Store);
	private readonly router = inject(Router);
	protected readonly i18n = inject(I18n);
	protected readonly t = this.i18n.t;
	protected readonly busy = signal(false);
	protected readonly error = signal<string | null>(null);
	protected readonly code = signal<DeviceCode | null>(null);
	protected readonly copied = signal(false);
	protected readonly repos = signal<RepoSummary[] | null>(null);
	protected readonly query = signal("");
	protected readonly recent = this.store.recent;
	private destroyed = false;

	protected readonly filtered = computed(() => {
		const q = this.query().trim().toLowerCase();
		const list = this.repos() ?? [];
		return q ? list.filter((r) => r.fullName.toLowerCase().includes(q)) : list;
	});

	protected readonly githubMark = GITHUB_MARK;

	constructor() {
		effect(() => {
			if (this.auth.signedIn() && this.repos() === null) this.loadRepos();
		});
		const query = new URLSearchParams(location.search);
		const code = query.get("code");
		const state = query.get("state");
		if (code && state) this.finishWeb(code, state);
	}

	protected next(): string | null {
		const next = this.router.parseUrl(this.router.url).queryParams["next"];
		return typeof next === "string" ? next : null;
	}

	private async finishWeb(code: string, state: string) {
		this.busy.set(true);
		try {
			const { next } = await this.auth.finishWeb(code, state);
			if (next && NEXT_PATTERN.test(next)) this.router.navigateByUrl(next, { replaceUrl: true });
			else this.router.navigate(["/"], { replaceUrl: true });
		} catch (e) {
			this.router.navigate(["/"], { replaceUrl: true });
			this.error.set(this.t().authErrors[e instanceof AuthFailure ? e.kind : "failed"]);
		} finally {
			this.busy.set(false);
		}
	}

	ngOnDestroy() {
		this.destroyed = true;
	}

	protected owner = (full: string) => full.split("/")[0];
	protected name = (full: string) => full.split("/")[1];

	private async loadRepos() {
		try {
			this.repos.set(await this.github.repos());
		} catch (e) {
			this.repos.set([]);
			this.error.set(this.t().errors[e instanceof GithubFailure ? e.kind : "failed"]);
		}
	}

	protected async startDevice() {
		this.error.set(null);
		this.busy.set(true);
		try {
			const code = await this.auth.startDevice();
			this.code.set(code);
			if (await this.auth.waitForDevice(code, () => this.destroyed)) this.goNext();
		} catch (e) {
			this.code.set(null);
			this.error.set(this.t().authErrors[e instanceof AuthFailure ? e.kind : "failed"]);
		} finally {
			this.busy.set(false);
		}
	}

	protected async copy(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			this.copied.set(true);
			setTimeout(() => this.copied.set(false), 2000);
		} catch {}
	}

	protected async useToken(event: Event) {
		event.preventDefault();
		const form = event.target as HTMLFormElement;
		const token = (new FormData(form).get("pat") as string).trim();
		if (!token) return;
		this.error.set(null);
		this.busy.set(true);
		this.auth.setToken(token);
		try {
			await this.github.user();
			form.reset();
			this.goNext();
		} catch (e) {
			this.auth.setToken(null);
			this.error.set(
				e instanceof GithubFailure && e.kind === "offline"
					? this.t().authErrors.offline
					: this.t().authErrors.badToken,
			);
		} finally {
			this.busy.set(false);
		}
	}

	private goNext() {
		const next = this.router.parseUrl(this.router.url).queryParams["next"];
		if (typeof next === "string" && NEXT_PATTERN.test(next)) this.router.navigateByUrl(next, { replaceUrl: true });
	}

	protected openTyped(event: Event) {
		event.preventDefault();
		const q = this.query()
			.trim()
			.replace(/^https?:\/\/github\.com\//, "")
			.replace(/\.git$|\/$/g, "");
		const match = /^([\w.-]+)\/([\w.-]+)$/.exec(q);
		if (match) this.router.navigate(["/", match[1], match[2]]);
		else if (this.filtered().length) this.router.navigate(["/", ...this.filtered()[0].fullName.split("/")]);
	}
}
