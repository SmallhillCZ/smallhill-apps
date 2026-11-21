import { Component, ElementRef, computed, effect, inject, signal, viewChild } from "@angular/core";
import { I18n, LANGS } from "./i18n";
import { UNTAGGED, addTags, matches, parseTags } from "./library";
import { type ActionResult, type MemeView, Memes } from "./memes.service";
import { THEMES, type Theme, applyTheme, loadTheme } from "./theme";

interface Toast {
	text: string;
	undo?: () => void;
}

@Component({
	selector: "app-root",
	host: {
		"(document:paste)": "onPaste($event)",
		"(document:dragover)": "onDragOver($event)",
		"(document:dragleave)": "onDragLeave($event)",
		"(document:drop)": "onDrop($event)",
	},
	template: `
		<header>
			<span class="brand"><img src="icon.svg" alt="" width="28" height="28" /> {{ t().appName }}</span>
			<div class="actions">
				<button type="button" class="primary add" (click)="filePicker.click()">
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" /></svg>
					{{ t().add }}
				</button>
				@if (canPaste) {
					<button
						type="button"
						class="icon"
						(click)="pasteFromClipboard()"
						[title]="t().pasteImage"
						[attr.aria-label]="t().pasteImage"
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path
								d="M9 2h6a1 1 0 0 1 1 1v1h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2V3a1 1 0 0 1 1-1zm1 2v2h4V4zM6 6v14h12V6h-2v2H8V6z"
							/>
						</svg>
					</button>
				}
				<button type="button" class="icon" popovertarget="menu" [attr.aria-label]="t().menu" [title]="t().menu">
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<circle cx="12" cy="5" r="2" />
						<circle cx="12" cy="12" r="2" />
						<circle cx="12" cy="19" r="2" />
					</svg>
				</button>
			</div>
			<div id="menu" class="menu" popover>
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
					<select class="theme" [attr.aria-label]="t().theme" (change)="setTheme($any($event.target).value)">
						@for (option of themes; track option) {
							<option [value]="option" [selected]="option === theme()">{{ t().themes[option] }}</option>
						}
					</select>
				</div>
				<div class="menu-row">
					<button type="button" class="link flush" (click)="backup()" [disabled]="!store.memes().length">
						{{ t().backup }}
					</button>
				</div>
				<div class="menu-row">
					<button type="button" class="link flush" (click)="closeMenu(); restorePicker.click()">
						{{ t().restore }}
					</button>
				</div>
			</div>
			<input
				#filePicker
				type="file"
				accept="image/*,video/*"
				multiple
				hidden
				(change)="onPicked($any($event.target))"
			/>
			<input
				#restorePicker
				type="file"
				accept=".zip,application/zip"
				hidden
				(change)="onRestore($any($event.target))"
			/>
		</header>

		@if (store.loaded()) {
			@if (store.memes().length) {
				<div class="filters">
					<div class="search">
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path
								d="M10 3a7 7 0 0 1 5.6 11.2l5.1 5.1-1.4 1.4-5.1-5.1A7 7 0 1 1 10 3zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"
							/>
						</svg>
						<input
							#searchInput
							type="search"
							[placeholder]="t().search"
							[attr.aria-label]="t().search"
							[value]="query()"
							(input)="query.set($any($event.target).value)"
						/>
					</div>
					@if (store.tags().length) {
						<div class="chips" role="group" [attr.aria-label]="t().tagsLabel">
							@for (tag of chips(); track tag.tag) {
								<button
									type="button"
									class="chip"
									[class.on]="selected().includes(tag.tag)"
									[attr.aria-pressed]="selected().includes(tag.tag)"
									(click)="toggleTag(tag.tag)"
								>
									{{ tag.tag === untagged ? t().untagged : tag.tag }}
									<span class="n">{{ tag.count }}</span>
								</button>
							}
						</div>
					}
				</div>

				<p class="muted small count">{{ t().count(visible().length) }}</p>
				@if (visible().length) {
					<ul class="grid">
						@for (meme of visible(); track meme.id) {
							<li class="tile">
								<button
									type="button"
									class="open"
									(click)="open(meme.id)"
									[attr.aria-label]="meme.title || meme.name"
								>
									@if (meme.video) {
										<video [src]="meme.url" muted playsinline preload="metadata"></video>
										<span class="badge">▶</span>
									} @else {
										<img [src]="meme.url" [alt]="meme.title" loading="lazy" decoding="async" />
									}
								</button>
								<button
									type="button"
									class="quick"
									(click)="share(meme)"
									[title]="t().share"
									[attr.aria-label]="t().quickShare(meme.title || meme.name)"
								>
									<svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="shareIcon" /></svg>
								</button>
							</li>
						}
					</ul>
				} @else {
					<p class="card muted">{{ t().nothingFound }}</p>
				}
			} @else {
				<section class="card empty">
					<img src="icon.svg" alt="" width="72" height="72" />
					<h1>{{ t().emptyTitle }}</h1>
					<p>{{ t().emptyText }}</p>
					<ul>
						<li>
							<strong>{{ t().emptyShare }}</strong> {{ t().emptyShareHint }}
						</li>
						<li>
							<button type="button" class="link flush" (click)="filePicker.click()">
								{{ t().emptyPick }}
							</button>
						</li>
						<li>{{ t().emptyPaste }}</li>
					</ul>
				</section>
			}
		}

		<dialog #dialog class="detail" (close)="onDialogClose()" (click)="onDialogClick($event)">
			@if (current(); as meme) {
				<div class="detail-body">
					<button
						type="button"
						class="icon close"
						(click)="dialog.close()"
						[attr.aria-label]="t().close"
						[title]="t().close"
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path
								d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z"
							/>
						</svg>
					</button>
					<div class="media">
						@if (meme.video) {
							<video [src]="meme.url" controls autoplay loop muted playsinline></video>
						} @else {
							<img [src]="meme.url" [alt]="meme.title" />
						}
					</div>
					<div class="buttons">
						<button type="button" class="primary" (click)="share(meme)">
							<svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="shareIcon" /></svg>
							{{ t().share }}
						</button>
						@if (!meme.video && canCopy) {
							<button type="button" (click)="copy(meme)">{{ t().copy }}</button>
						}
						<button type="button" (click)="download(meme)">{{ t().download }}</button>
						<button type="button" class="danger" (click)="remove(meme)">{{ t().delete }}</button>
					</div>
					<label for="title">{{ t().titleLabel }}</label>
					<input
						id="title"
						type="text"
						autocomplete="off"
						[placeholder]="t().titlePlaceholder"
						[value]="meme.title"
						(change)="setTitle(meme, $any($event.target).value)"
						(keydown.enter)="$any($event.target).blur()"
					/>
					<label for="tag-input">{{ t().tagsLabel }}</label>
					<div class="tag-editor" (click)="tagInput.focus()">
						@for (tag of meme.tags; track tag) {
							<span class="chip on">
								{{ tag }}
								<button
									type="button"
									class="x"
									(click)="removeTag(meme, tag)"
									[attr.aria-label]="t().removeTag(tag)"
								>
									×
								</button>
							</span>
						}
						<input
							#tagInput
							id="tag-input"
							type="text"
							list="known-tags"
							autocomplete="off"
							enterkeyhint="done"
							[placeholder]="meme.tags.length ? '' : t().tagsPlaceholder"
							(keydown)="onTagKey(meme, $event)"
							(input)="onTagInput(meme, $any($event.target))"
							(blur)="commitTag(meme, $any($event.target))"
						/>
					</div>
					<datalist id="known-tags">
						@for (tag of store.tags(); track tag.tag) {
							@if (!meme.tags.includes(tag.tag)) {
								<option [value]="tag.tag"></option>
							}
						}
					</datalist>
					<p class="muted small">{{ meme.uses ? t().used(meme.uses) : t().neverUsed }}</p>
				</div>
			}
		</dialog>

		@if (dragging()) {
			<div class="drop" aria-hidden="true">
				<span>{{ t().add }}</span>
			</div>
		}

		<div #toastEl class="toast" popover="manual" role="status">
			@if (toast(); as toast) {
				<span>{{ toast.text }}</span>
				@if (toast.undo) {
					<button type="button" class="link" (click)="toast.undo(); hideToast()">{{ t().undo }}</button>
				}
			}
		</div>
	`,
	styleUrl: "./app.css",
})
export class App {
	protected readonly i18n = inject(I18n);
	protected readonly store = inject(Memes);
	protected readonly t = this.i18n.t;
	protected readonly langs = LANGS;
	protected readonly themes = THEMES;
	protected readonly untagged = UNTAGGED;
	protected readonly theme = signal<Theme>(loadTheme());
	protected readonly query = signal("");
	protected readonly selected = signal<string[]>([]);
	protected readonly currentId = signal<string | null>(null);
	protected readonly dragging = signal(false);
	protected readonly toast = signal<Toast | null>(null);
	protected readonly canPaste = typeof navigator !== "undefined" && !!navigator.clipboard?.read;
	protected readonly canCopy = typeof ClipboardItem !== "undefined" && !!navigator.clipboard?.write;
	protected readonly shareIcon =
		"M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7l-6.7 3.4a3 3 0 1 0 0 3.2L15 17a3 3 0 1 0 3-1z";

	private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");
	private readonly toastEl = viewChild.required<ElementRef<HTMLElement>>("toastEl");
	private readonly tagInput = viewChild<ElementRef<HTMLInputElement>>("tagInput");
	private toastTimer: ReturnType<typeof setTimeout> | undefined;
	private dragDepth = 0;

	protected readonly current = computed(() => {
		const id = this.currentId();
		return id ? (this.store.memes().find((m) => m.id === id) ?? null) : null;
	});

	protected readonly chips = computed(() => {
		const tags = this.store.tags();
		const untagged = this.store.memes().filter((m) => !m.tags.length).length;
		return untagged && tags.length ? [...tags, { tag: UNTAGGED, count: untagged }] : tags;
	});

	protected readonly visible = computed(() => {
		const query = this.query();
		const selected = this.selected();
		return this.store.memes().filter((m) => matches(m, query, selected));
	});

	constructor() {
		applyTheme(this.theme());
		this.store.load().then(() => this.handleShared());
		effect(() => {
			const known = new Set([...this.store.tags().map((t) => t.tag), UNTAGGED]);
			const selected = this.selected();
			if (selected.some((t) => !known.has(t))) this.selected.set(selected.filter((t) => known.has(t)));
		});
	}

	protected setTheme(theme: Theme) {
		this.theme.set(theme);
		applyTheme(theme);
	}

	protected closeMenu() {
		document.getElementById("menu")?.hidePopover();
	}

	protected toggleTag(tag: string) {
		this.selected.update((s) => (s.includes(tag) ? s.filter((t) => t !== tag) : [...s, tag]));
	}

	protected open(id: string, focusTags = false) {
		this.currentId.set(id);
		const dialog = this.dialog().nativeElement;
		if (!dialog.open) dialog.showModal();
		if (focusTags) setTimeout(() => this.tagInput()?.nativeElement.focus());
	}

	protected onDialogClose() {
		const input = this.tagInput()?.nativeElement;
		const meme = this.current();
		if (input && meme) this.commitTag(meme, input);
		this.currentId.set(null);
	}

	protected onDialogClick(event: MouseEvent) {
		if (event.target === this.dialog().nativeElement) this.dialog().nativeElement.close();
	}

	protected async onPicked(input: HTMLInputElement) {
		const files = [...(input.files ?? [])];
		input.value = "";
		await this.addFiles(files);
	}

	protected onPaste(event: ClipboardEvent) {
		const target = event.target as HTMLElement | null;
		if (target?.closest("input, textarea")) return;
		const files = [...(event.clipboardData?.files ?? [])];
		if (!files.length) return;
		event.preventDefault();
		this.addFiles(files);
	}

	protected async pasteFromClipboard() {
		try {
			const items = await navigator.clipboard.read();
			const blobs: Blob[] = [];
			for (const item of items) {
				const type = item.types.find((t) => t.startsWith("image/"));
				if (type) blobs.push(await item.getType(type));
			}
			if (!blobs.length) return this.showToast(this.t().pasteEmpty);
			await this.addFiles(blobs);
		} catch {
			this.showToast(this.t().pasteEmpty);
		}
	}

	protected onDragOver(event: DragEvent) {
		if (!event.dataTransfer?.types.includes("Files")) return;
		event.preventDefault();
		this.dragging.set(true);
	}

	protected onDragLeave(event: DragEvent) {
		if (!event.relatedTarget) this.dragging.set(false);
	}

	protected onDrop(event: DragEvent) {
		this.dragging.set(false);
		const files = [...(event.dataTransfer?.files ?? [])];
		if (!files.length) return;
		event.preventDefault();
		this.addFiles(files);
	}

	protected async share(meme: MemeView) {
		this.report(await this.store.share(meme));
	}

	protected async copy(meme: MemeView) {
		this.report(await this.store.copy(meme));
	}

	protected async download(meme: MemeView) {
		await this.store.download(meme);
	}

	protected async remove(meme: MemeView) {
		const removed = await this.store.remove(meme.id);
		this.dialog().nativeElement.close();
		if (removed) this.showToast(this.t().deleted, () => this.store.restore(removed));
	}

	protected setTitle(meme: MemeView, value: string) {
		const title = value.trim();
		if (title !== meme.title) this.store.update(meme.id, { title });
	}

	protected onTagKey(meme: MemeView, event: KeyboardEvent) {
		const input = event.target as HTMLInputElement;
		if (event.key === "Enter" || event.key === ",") {
			event.preventDefault();
			this.commitTag(meme, input);
		} else if (event.key === "Backspace" && !input.value && meme.tags.length) {
			this.store.update(meme.id, { tags: meme.tags.slice(0, -1) });
		}
	}

	protected onTagInput(meme: MemeView, input: HTMLInputElement) {
		if (/[,;#]/.test(input.value)) this.commitTag(meme, input);
	}

	protected commitTag(meme: MemeView, input: HTMLInputElement) {
		const tags = parseTags(input.value);
		input.value = "";
		if (!tags.length) return;
		const current = this.store.find(meme.id);
		if (current) this.store.update(meme.id, { tags: addTags(current.tags, tags) });
	}

	protected removeTag(meme: MemeView, tag: string) {
		this.store.update(meme.id, { tags: meme.tags.filter((t) => t !== tag) });
	}

	protected async backup() {
		this.closeMenu();
		const blob = await this.store.backup();
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = `memes-${new Date().toISOString().slice(0, 10)}.zip`;
		document.body.append(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(a.href), 10000);
	}

	protected async onRestore(input: HTMLInputElement) {
		const file = input.files?.[0];
		input.value = "";
		if (!file) return;
		try {
			this.showToast(this.t().restored(await this.store.restoreBackup(file)));
		} catch {
			this.showToast(this.t().restoreFailed);
		}
	}

	protected hideToast() {
		clearTimeout(this.toastTimer);
		this.toast.set(null);
		const el = this.toastEl().nativeElement;
		if (el.matches(":popover-open")) el.hidePopover();
	}

	private async addFiles(files: (File | Blob)[]) {
		if (!files.length) return;
		try {
			const added = await this.store.addFiles(files);
			if (!added.length) return this.showToast(this.t().notMedia);
			this.query.set("");
			this.selected.set([]);
			if (added.length === 1) this.open(added[0].id, true);
			else this.showToast(this.t().added(added.length));
		} catch {
			this.showToast(this.t().storageFailed);
		}
	}

	private handleShared() {
		const params = new URLSearchParams(location.search);
		const shared = params.get("shared");
		if (shared === null) return;
		history.replaceState(null, "", location.pathname);
		const ids = shared.split(",").filter((id) => this.store.find(id));
		if (!ids.length) return this.showToast(this.t().shareFailed);
		if (ids.length === 1) this.open(ids[0], true);
		else this.showToast(this.t().added(ids.length));
	}

	private report(result: ActionResult) {
		const t = this.t();
		const text: Partial<Record<ActionResult, string>> = {
			copied: t.copied,
			copiedStill: t.copiedStill,
			failed: t.copyFailed,
			video: t.copyVideo,
			downloaded: t.shareUnsupported,
		};
		if (text[result]) this.showToast(text[result]!);
	}

	private showToast(text: string, undo?: () => void) {
		clearTimeout(this.toastTimer);
		this.toast.set({ text, undo });
		const el = this.toastEl().nativeElement;
		if (el.matches(":popover-open")) el.hidePopover();
		el.showPopover();
		this.toastTimer = setTimeout(() => this.hideToast(), undo ? 6000 : 3500);
	}
}
