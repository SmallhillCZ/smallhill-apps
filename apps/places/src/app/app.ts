import { Component, inject, signal, viewChild } from "@angular/core";
import { I18n, LANGS } from "./i18n";
import { Lists, ListFailure, MAPSETS, type ListError, type Mapset, type Place, type SavedList } from "./lists";
import { MapView } from "./map";
import { THEMES, Theme, applyTheme, loadTheme } from "./theme";

@Component({
	imports: [MapView],
	selector: "app-root",
	template: `
		<header>
			<span class="brand"><img src="icon.svg" alt="" width="28" height="28" /> {{ t().appName }}</span>
			<div class="actions">
				<button
					type="button"
					class="icon panel-toggle"
					[attr.aria-expanded]="panelOpen()"
					[attr.aria-label]="panelOpen() ? t().hidePanel : t().showPanel"
					[title]="panelOpen() ? t().hidePanel : t().showPanel"
					(click)="togglePanel()"
				>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M4 6h16M4 12h16M4 18h10" />
					</svg>
				</button>
				@if (store.lists().length) {
					<button
						type="button"
						class="icon"
						[attr.aria-label]="t().share"
						[title]="t().share"
						(click)="share()"
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<circle cx="18" cy="5" r="2.5" />
							<circle cx="6" cy="12" r="2.5" />
							<circle cx="18" cy="19" r="2.5" />
							<path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" />
						</svg>
					</button>
				}
				<button
					type="button"
					class="icon more"
					popovertarget="menu"
					[attr.aria-label]="t().menu"
					[title]="t().menu"
				>
					<svg viewBox="0 0 24 24" aria-hidden="true" class="dots">
						<circle cx="12" cy="5" r="2" />
						<circle cx="12" cy="12" r="2" />
						<circle cx="12" cy="19" r="2" />
					</svg>
				</button>
			</div>
			<div id="menu" class="menu" popover>
				<div class="menu-row">
					<span>{{ t().mapStyle }}</span>
					<select
						[attr.aria-label]="t().mapStyle"
						[value]="store.mapset()"
						(change)="store.setMapset($any($event.target).value)"
					>
						@for (m of mapsets; track m) {
							<option [value]="m" [selected]="m === store.mapset()">{{ t().mapsets[m] }}</option>
						}
					</select>
				</div>
				<div class="menu-row">
					<span>{{ t().language }}</span>
					<div class="langs" role="group" [attr.aria-label]="t().language">
						@for (l of langs; track l) {
							<button
								type="button"
								class="link small"
								[class.on]="i18n.lang() === l"
								[attr.aria-pressed]="i18n.lang() === l"
								[attr.lang]="l"
								(click)="i18n.setLang(l)"
							>
								{{ l.toUpperCase() }}
							</button>
						}
					</div>
				</div>
				<div class="menu-row">
					<span>{{ t().theme }}</span>
					<select
						[attr.aria-label]="t().theme"
						[value]="theme()"
						(change)="setTheme($any($event.target).value)"
					>
						@for (option of themes; track option) {
							<option [value]="option" [selected]="option === theme()">{{ t().themes[option] }}</option>
						}
					</select>
				</div>
				@if (store.lists().length) {
					<div class="menu-row">
						<button type="button" class="link" (click)="refreshAll()">{{ t().refreshAll }}</button>
					</div>
				}
			</div>
		</header>
		<div class="body">
			<app-map />
			@if (panelOpen()) {
				<aside class="panel">
					<div class="panel-head">
						<h1>{{ t().lists }}</h1>
						@if (store.visiblePlaces().length) {
							<button type="button" class="link small" (click)="map().fitAll()">{{ t().fit }}</button>
						}
					</div>
					@if (notice(); as text) {
						<p class="notice small" role="status">{{ text }}</p>
					}
					@if (importing()) {
						<p class="muted small">{{ t().importing }}</p>
					} @else if (!store.lists().length) {
						<p class="muted small">{{ t().empty }}</p>
					}
					<ul class="lists">
						@for (list of store.lists(); track list.url) {
							<li class="list">
								<div class="list-row">
									<button
										type="button"
										class="swatch"
										[style.background]="list.color"
										[attr.aria-label]="t().color"
										[title]="t().color"
										(click)="store.nextColor(list.url)"
									></button>
									<label class="list-label">
										<input
											type="checkbox"
											[checked]="list.visible"
											[attr.aria-label]="t().show"
											(change)="store.toggle(list.url)"
										/>
										<span class="list-title">{{ list.data?.title || t().untitled }}</span>
									</label>
									<span class="count muted small">{{ list.data?.places?.length ?? 0 }}</span>
									<button
										type="button"
										class="icon chevron"
										[class.open]="expanded() === list.url"
										[attr.aria-expanded]="expanded() === list.url"
										[attr.aria-label]="expanded() === list.url ? t().collapse : t().expand"
										[title]="expanded() === list.url ? t().collapse : t().expand"
										(click)="expand(list.url)"
									>
										<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
									</button>
								</div>
								@if (store.errors()[list.url]; as error) {
									<div class="error small">{{ message(error) }}</div>
								}
								@if (expanded() === list.url) {
									<div class="list-body">
										@if (list.data?.description) {
											<p class="muted small">{{ list.data!.description }}</p>
										}
										<ul class="places">
											@for (place of list.data?.places ?? []; track $index) {
												<li>
													<button type="button" class="place" (click)="focus(list, place)">
														<span class="place-name">{{ place.name }}</span>
														@if (place.note) {
															<span class="place-note small">{{ place.note }}</span>
														}
														@if (place.address) {
															<span class="muted small">{{ place.address }}</span>
														}
													</button>
												</li>
											}
										</ul>
										<div class="list-actions">
											@if (list.savedAt) {
												<span class="muted small">{{ t().cached(when(list.savedAt)) }}</span>
											}
											<button
												type="button"
												class="link small"
												[disabled]="store.loading().has(list.url)"
												(click)="store.refresh(list.url, i18n.lang())"
											>
												{{ t().refresh }}
											</button>
											<button
												type="button"
												class="link small danger"
												(click)="store.remove(list.url)"
											>
												{{ t().remove }}
											</button>
										</div>
									</div>
								}
							</li>
						}
					</ul>
					<form class="add" (submit)="add($event)">
						<label for="link">{{ t().addTitle }}</label>
						<div class="add-row">
							<input
								id="link"
								name="link"
								type="url"
								inputmode="url"
								autocomplete="off"
								required
								[placeholder]="t().linkPlaceholder"
								[value]="link()"
								(input)="link.set($any($event.target).value)"
							/>
							<button type="submit" class="primary" [disabled]="adding() || !link().trim()">
								{{ adding() ? t().adding : t().add }}
							</button>
						</div>
						@if (addError(); as error) {
							<div class="error small">{{ message(error) }}</div>
						}
						<p class="muted small hint">{{ t().addHint }}</p>
					</form>
				</aside>
			}
		</div>
	`,
	styles: `
		:host {
			display: grid;
			grid-template-rows: auto 1fr;
			height: 100dvh;
		}
		header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0.5rem 1rem;
			padding-top: max(0.5rem, env(safe-area-inset-top));
			background: var(--surface);
			border-bottom: 1px solid var(--border);
			z-index: 1001;
		}
		.brand {
			display: inline-flex;
			align-items: center;
			gap: 0.5rem;
			font-weight: 700;
			font-size: 1.1rem;
		}
		.actions {
			display: flex;
			gap: 0.25rem;
			margin-right: -8px;
		}
		.icon {
			display: grid;
			place-items: center;
			width: 36px;
			height: 36px;
			padding: 0;
			border: 0;
			border-radius: 50%;
			background: transparent;
			color: var(--muted);
		}
		.icon svg {
			width: 20px;
			height: 20px;
			fill: none;
			stroke: currentColor;
			stroke-width: 2;
			stroke-linecap: round;
			stroke-linejoin: round;
		}
		.icon svg.dots {
			fill: currentColor;
			stroke: none;
		}
		.menu {
			position: fixed;
			inset: auto;
			top: calc(max(0.5rem, env(safe-area-inset-top)) + 40px);
			right: max(16px, env(safe-area-inset-right));
			margin: 0;
			min-width: 240px;
			padding: 0.25rem 1rem;
			border: 1px solid var(--border);
			border-radius: var(--radius);
			background: var(--surface);
			color: var(--text);
			box-shadow: var(--shadow);
		}
		.menu:popover-open {
			display: grid;
		}
		.menu-row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 1rem;
			min-height: 44px;
		}
		.menu-row + .menu-row {
			border-top: 1px solid var(--border);
		}
		.menu-row > span {
			font-weight: 600;
		}
		.menu-row > .link {
			padding-left: 0;
		}
		.langs {
			display: flex;
			gap: 2px;
		}
		.langs button {
			color: var(--muted);
		}
		.langs button.on {
			color: var(--accent);
			font-weight: 700;
		}
		select {
			font: inherit;
			font-size: 0.9rem;
			color: var(--text);
			background: var(--bg);
			border: 1px solid var(--border);
			border-radius: 8px;
			padding: 0.3rem 0.5rem;
			cursor: pointer;
		}
		.body {
			position: relative;
			min-height: 0;
		}
		app-map {
			position: absolute;
			inset: 0;
		}
		.panel {
			position: absolute;
			z-index: 1000;
			top: 12px;
			left: 12px;
			max-height: calc(100% - 24px);
			width: 340px;
			overflow-y: auto;
			padding: 1rem;
			background: var(--surface);
			color: var(--text);
			border: 1px solid var(--border);
			border-radius: var(--radius);
			box-shadow: var(--shadow);
		}
		@media (max-width: 640px) {
			.panel {
				top: auto;
				left: 0;
				right: 0;
				bottom: 0;
				width: auto;
				max-height: 45%;
				border-radius: var(--radius) var(--radius) 0 0;
				border-bottom: 0;
				padding-bottom: max(1rem, env(safe-area-inset-bottom));
			}
		}
		.panel-head {
			display: flex;
			align-items: baseline;
			justify-content: space-between;
			gap: 0.5rem;
		}
		h1 {
			font-size: 1.2rem;
		}
		ul {
			list-style: none;
			margin: 0;
			padding: 0;
		}
		.list {
			border-bottom: 1px solid var(--border);
		}
		.list-row {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			min-height: 44px;
		}
		.swatch {
			flex: none;
			width: 18px;
			height: 18px;
			padding: 0;
			border-radius: 50%;
			border: 2px solid var(--surface);
			box-shadow: 0 0 0 1px var(--border);
		}
		.list-label {
			flex: 1;
			display: flex;
			align-items: center;
			gap: 0.5rem;
			min-width: 0;
			margin: 0;
			font-weight: 600;
			cursor: pointer;
		}
		.list-label input {
			flex: none;
			width: 18px;
			height: 18px;
			accent-color: var(--accent);
		}
		.list-title {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.chevron svg {
			transition: transform 0.15s;
		}
		.chevron.open svg {
			transform: rotate(90deg);
		}
		.list-body {
			padding: 0 0 0.75rem 1.6rem;
		}
		.place {
			display: grid;
			gap: 0.1rem;
			width: 100%;
			padding: 0.45rem 0.5rem;
			margin-left: -0.5rem;
			border: 0;
			border-radius: 8px;
			background: transparent;
			text-align: left;
			font-weight: 500;
			justify-content: stretch;
		}
		.place:hover {
			background: var(--bg);
		}
		.place-note {
			font-style: italic;
		}
		.list-actions {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.25rem 0.5rem;
			margin-top: 0.5rem;
		}
		.list-actions .muted {
			flex: 1 1 100%;
		}
		.list-actions .link {
			padding-left: 0;
		}
		.danger {
			color: var(--error) !important;
		}
		.error {
			margin: 0 0 0.5rem;
		}
		.add {
			margin-top: 1rem;
		}
		.add label {
			font-size: 0.95rem;
		}
		.add-row {
			display: flex;
			gap: 0.5rem;
			margin-bottom: 0.5rem;
		}
		.add-row input {
			flex: 1;
			min-width: 0;
			font: inherit;
			font-size: 0.95rem;
			color: inherit;
			background: var(--bg);
			border: 1px solid var(--border);
			border-radius: 8px;
			padding: 0.55rem 0.7rem;
		}
		.hint {
			margin: 0;
		}
		.notice {
			margin: 0 0 0.75rem;
			padding: 0.5rem 0.75rem;
			border-radius: 8px;
			background: var(--bg);
			border: 1px solid var(--border);
		}
	`,
})
export class App {
	protected readonly i18n = inject(I18n);
	protected readonly store = inject(Lists);
	protected readonly map = viewChild.required(MapView);
	protected readonly t = this.i18n.t;
	protected readonly langs = LANGS;
	protected readonly themes = THEMES;
	protected readonly mapsets = MAPSETS;
	protected readonly theme = signal<Theme>(loadTheme());
	protected readonly panelOpen = signal(true);
	protected readonly expanded = signal<string | null>(null);
	protected readonly link = signal("");
	protected readonly adding = signal(false);
	protected readonly addError = signal<ListError | null>(null);

	protected readonly importing = signal(false);
	protected readonly notice = signal<string | null>(null);
	private noticeTimer: ReturnType<typeof setTimeout> | undefined;

	constructor() {
		applyTheme(this.theme());
		if (this.store.lists().length) this.store.refreshAll(this.i18n.lang());
		this.importShared();
	}

	private async importShared() {
		if (!new URL(location.href).searchParams.has("list")) return;
		this.importing.set(true);
		const { added, failed } = await this.store.importShared(this.i18n.lang());
		this.importing.set(false);
		this.panelOpen.set(true);
		if (failed) this.notify(this.t().importFailed(failed));
		if (added) setTimeout(() => this.map().fitAll());
	}

	protected async share() {
		const url = this.store.shareUrl();
		if (navigator.share) {
			try {
				await navigator.share({ title: this.t().shareTitle, url });
				return;
			} catch (err) {
				if (err instanceof DOMException && err.name === "AbortError") return;
			}
		}
		try {
			await navigator.clipboard.writeText(url);
			this.notify(this.t().linkCopied);
		} catch {
			prompt(this.t().share, url);
		}
	}

	private notify(text: string) {
		this.panelOpen.set(true);
		this.notice.set(text);
		clearTimeout(this.noticeTimer);
		this.noticeTimer = setTimeout(() => this.notice.set(null), 6000);
	}

	protected setTheme(theme: Theme) {
		this.theme.set(theme);
		applyTheme(theme);
	}

	protected togglePanel() {
		this.panelOpen.update((open) => !open);
	}

	protected expand(url: string) {
		this.expanded.update((current) => (current === url ? null : url));
	}

	protected refreshAll() {
		document.getElementById("menu")?.hidePopover();
		this.store.refreshAll(this.i18n.lang());
	}

	protected focus(list: SavedList, place: Place) {
		if (!list.visible) this.store.toggle(list.url);
		if (matchMedia("(max-width: 640px)").matches) this.panelOpen.set(false);
		setTimeout(() => this.map().focus(this.store.visiblePlaces().find((p) => p.place === place)?.place ?? place));
	}

	protected async add(event: Event) {
		event.preventDefault();
		if (this.adding()) return;
		this.adding.set(true);
		this.addError.set(null);
		try {
			const saved = await this.store.add(this.link(), this.i18n.lang());
			this.link.set("");
			this.expanded.set(saved.url);
			setTimeout(() => this.map().fitAll());
		} catch (err) {
			this.addError.set(err instanceof ListFailure ? err.kind : "google");
		} finally {
			this.adding.set(false);
		}
	}

	protected message(error: ListError) {
		const t = this.t();
		return {
			url: t.badUrl,
			notfound: t.notFound,
			google: t.googleDown,
			offline: t.offline,
			duplicate: t.alreadyAdded,
		}[error];
	}

	protected when(iso: string) {
		return new Date(iso).toLocaleString(this.i18n.locale(), { dateStyle: "medium", timeStyle: "short" });
	}
}
