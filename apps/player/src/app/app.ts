import {
	afterRenderEffect,
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	effect,
	ElementRef,
	inject,
	signal,
	untracked,
	viewChild,
} from "@angular/core";
import { DeviceService, PickedFolder } from "./device/device.service";
import { lang, LANGS, setLang, T } from "./i18n";
import { Icon } from "./icon";
import { cacheChildren, cachedChildren, clearCache } from "./onedrive/folder-cache";
import { DriveItem, Folder, formatTime, sortFolders, sortTracks, toTrack, Track } from "./onedrive/items";
import { OneDriveService } from "./onedrive/onedrive.service";
import { PlayerService, QueuedTrack } from "./player/player.service";
import {
	loadLocation,
	locationFromUrl,
	locationToUrl,
	loadSession,
	loadSources,
	rootLabel,
	saveLocation,
	saveSession,
	saveSources,
	Source,
	toFolders,
	withRenamedRoot,
} from "./sources";
import { idbGet } from "./storage/idb";
import { applyTheme, loadTheme, Theme, THEMES } from "./theme";

export type SourceState = "loading" | "ready" | "signin" | "permission" | "missing";

interface NavState {
	player: true;
	path: Folder[];
	picking?: boolean;
}

function isNavState(value: unknown): value is NavState {
	const state = value as Partial<NavState> | null;
	return !!state && state.player === true && !!toFolders(state.path);
}

@Component({
	selector: "app-root",
	imports: [Icon],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./app.html",
	styleUrl: "./app.scss",
})
export class App {
	protected readonly drive = inject(OneDriveService);
	protected readonly device = inject(DeviceService);
	protected readonly player = inject(PlayerService);
	protected readonly t = T;
	protected readonly lang = lang;
	protected readonly langs = LANGS;
	protected readonly setLang = setLang;
	protected readonly themes = THEMES;
	protected readonly theme = signal<Theme>(loadTheme());
	protected readonly formatTime = formatTime;

	private readonly storedSources = loadSources();
	protected readonly sources = signal<Source[]>(this.storedSources ?? []);
	protected readonly path = signal<Folder[]>(loadLocation());
	protected readonly picking = signal(false);
	protected readonly playingPath = computed(() => this.player.current()?.path ?? []);
	protected readonly queueOpen = signal(false);
	private readonly queueDialog = viewChild<ElementRef<HTMLDialogElement>>("queue");
	protected readonly added = signal<string | null>(null);
	private addedTimer = 0;
	protected readonly editing = signal<string | null>(null);
	protected readonly editingSource = computed(() => this.sources().find((s) => s.id === this.editing()) ?? null);
	private readonly settingsDialog = viewChild<ElementRef<HTMLDialogElement>>("settings");
	private session = loadSession();
	protected readonly rootLabel = rootLabel;
	protected readonly items = signal<DriveItem[]>([]);
	protected readonly loading = signal(false);
	protected readonly failed = signal(false);
	private request = 0;
	private pendingRepick: string | null = null;
	private revealTrack = false;
	private readonly crumbs = viewChild<ElementRef<HTMLElement>>("crumbs");

	protected readonly source = computed(() => this.sources().find((s) => s.id === this.path()[0]?.id) ?? null);
	protected readonly state = computed(() => {
		const source = this.source();
		return source ? this.stateOf(source) : null;
	});
	protected readonly folders = computed(() => sortFolders(this.items()));
	protected readonly tracks = computed<Track[]>(() => sortTracks(this.items()).map(toTrack));
	protected readonly folderId = computed(() => {
		const path = this.path();
		if (path.length > 1) return path.at(-1)!.id;
		const source = this.source();
		return this.picking() || source?.kind !== "onedrive" ? null : (source.root?.at(-1)?.id ?? null);
	});
	protected readonly inPlayingFolder = computed(() => {
		const playing = this.playingPath();
		const path = this.path();
		return (
			!this.picking() && playing.length === path.length && playing.every((folder, i) => folder.id === path[i]?.id)
		);
	});
	protected readonly progress = computed(() => {
		const duration = this.player.duration();
		return duration ? Math.min(100, (this.player.time() / duration) * 100) : 0;
	});

	constructor() {
		const state: unknown = history.state;
		const fromUrl = locationFromUrl(location.href);
		if (fromUrl) this.show(fromUrl.path, fromUrl.picking);
		else if (isNavState(state)) this.show(state.path, !!state.picking);
		if (!location.hash) history.replaceState(this.navState(), "", this.navUrl());
		const onPopState = (event: PopStateEvent) => {
			const state: unknown = event.state;
			const fromUrl = locationFromUrl(location.href);
			if (fromUrl) this.show(fromUrl.path, fromUrl.picking);
			else if (isNavState(state)) this.show(state.path, !!state.picking);
			else this.show([]);
		};
		window.addEventListener("popstate", onPopState);
		inject(DestroyRef).onDestroy(() => window.removeEventListener("popstate", onPopState));

		void this.device.init(
			this.sources()
				.filter((s) => s.kind === "device")
				.map((s) => s.id),
		);
		if (!this.storedSources) void this.migrateDevice();

		this.player.setResolver((track) => this.downloadUrl(track));
		effect(() => applyTheme(this.theme()));
		effect(() => (document.documentElement.lang = lang()));
		effect(() => (document.title = T().title));
		effect(() => saveSources(this.sources()));
		effect(() => saveLocation(this.picking() ? [] : this.path()));
		effect(() => {
			if (this.drive.status() !== "ready") return;
			const accounts = this.drive.accounts();
			const signedIn = this.drive.signedIn();
			untracked(() => {
				const known = new Set(this.sources().map((s) => s.account));
				const added = accounts
					.filter((account) => !known.has(account.id) && (!this.storedSources || account.id === signedIn?.id))
					.map<Source>((account) => ({
						id: account.id,
						kind: "onedrive",
						name: "OneDrive",
						account: account.id,
					}));
				if (!added.length) return;
				this.sources.update((sources) => [...sources, ...added]);
				if (signedIn && added.some((s) => s.account === signedIn.id)) {
					this.navigate([{ id: signedIn.id, name: "OneDrive" }]);
				}
			});
		});
		afterRenderEffect(() => {
			const dialog = this.settingsDialog()?.nativeElement;
			if (dialog && !dialog.open) dialog.showModal();
		});
		afterRenderEffect(() => {
			const dialog = this.queueDialog()?.nativeElement;
			if (dialog && !dialog.open) {
				dialog.showModal();
				dialog.querySelector(".row.active")?.scrollIntoView({ block: "center" });
			}
		});
		effect(() => {
			if (!this.player.current()) untracked(() => this.queueOpen.set(false));
		});
		effect(() => this.restoreSession());
		effect(() => {
			const tracks = this.player.tracks();
			const queue = this.player.queue();
			const time = Math.floor(this.player.time() / 5) * 5;
			untracked(() => {
				if (this.session) {
					if (!tracks.length) return;
					this.session = null;
				}
				saveSession(tracks.length && queue.order.length ? { tracks, queue, time } : null);
			});
		});
		afterRenderEffect(() => {
			this.tracks();
			if (!this.revealTrack) return;
			const active = document.querySelector(".row.active");
			if (!active) return;
			this.revealTrack = false;
			active.scrollIntoView({ block: "center" });
		});
		afterRenderEffect(() => {
			this.path();
			const crumbs = this.crumbs()?.nativeElement;
			if (crumbs) crumbs.scrollLeft = crumbs.scrollWidth;
		});
		effect(() => {
			const path = this.path();
			const source = this.source();
			if (path.length && !source && this.storedSources !== null) {
				if (this.drive.status() !== "loading")
					untracked(() => {
						this.show([]);
						if (!location.hash) history.replaceState(this.navState(), "", this.navUrl());
					});
				return;
			}
			if (source && this.state() === "ready") void this.load(source, this.folderId());
		});
	}

	private async migrateDevice(): Promise<void> {
		const handle = await idbGet<{ name: string }>("handles", "device");
		if (!handle) return;
		this.sources.update((sources) => [...sources, { id: "device", kind: "device", name: handle.name }]);
		await this.device.init(["device"]);
	}

	protected stateOf(source: Source): SourceState {
		if (source.kind === "device") return this.device.states()[source.id] ?? "loading";
		const status = this.drive.status();
		if (status === "loading") return "loading";
		return this.drive.accounts().some((account) => account.id === source.account) ? "ready" : "signin";
	}

	protected accountLabel(source: Source): string {
		return this.drive.accounts().find((account) => account.id === source.account)?.username ?? "";
	}

	private downloadUrl(track: QueuedTrack): Promise<string> {
		const source = this.sources().find((s) => s.id === track.source);
		if (!source) return Promise.reject(new Error("Unknown source"));
		return source.kind === "onedrive"
			? this.drive.downloadUrl(source.account!, track.id)
			: this.device.downloadUrl(source.id, track.id);
	}

	private children(source: Source, folderId: string | null): Promise<DriveItem[]> {
		return source.kind === "onedrive"
			? this.drive.children(source.account!, folderId)
			: this.device.children(source.id, folderId);
	}

	private queued(tracks: Track[], path: Folder[]): QueuedTrack[] {
		return tracks.map((track) => ({ ...track, source: path[0].id, path }));
	}

	protected async load(source: Source, folderId: string | null): Promise<void> {
		const request = ++this.request;
		this.failed.set(false);
		const cacheKey = `${source.id}/${folderId ?? ""}`;
		const cached = source.kind === "onedrive" ? await cachedChildren(cacheKey) : null;
		if (request !== this.request) return;
		if (cached) this.items.set(cached);
		this.loading.set(!cached);
		try {
			const items = await this.children(source, folderId);
			if (request !== this.request) return;
			this.items.set(items);
			if (source.kind === "onedrive") void cacheChildren(cacheKey, items);
		} catch (error) {
			if (request !== this.request) return;
			console.error(error);
			if (!cached) {
				this.items.set([]);
				this.failed.set(true);
			}
		} finally {
			if (request === this.request) this.loading.set(false);
		}
	}

	protected retry(): void {
		const source = this.source();
		if (source) void this.load(source, this.folderId());
	}

	private navigate(path: Folder[], picking = this.picking() && path.length > 0): void {
		if (!isNavState(history.state)) history.replaceState(this.navState(), "", this.navUrl());
		this.show(path, picking);
		history.pushState(this.navState(), "", this.navUrl());
	}

	private navState(): NavState {
		return { player: true, path: this.path(), picking: this.picking() };
	}

	private navUrl(): string {
		return locationToUrl(location.href, { path: this.path(), picking: this.picking() });
	}

	private show(path: Folder[], picking = false): void {
		this.items.set([]);
		this.editing.set(null);
		this.picking.set(picking && path.length > 0);
		this.path.set(withRenamedRoot(path, this.sources()));
	}

	protected async openSource(source: Source, picker: HTMLInputElement): Promise<void> {
		const state = this.stateOf(source);
		if (state === "signin") {
			await this.drive.signIn(source.account!);
			return;
		}
		if (state === "permission" && !(await this.device.allow(source.id))) return;
		if (state === "missing") {
			this.pendingRepick = source.id;
			picker.click();
			return;
		}
		this.navigate([{ id: source.id, name: source.name }]);
	}

	protected async addFolder(picker: HTMLInputElement): Promise<void> {
		if (!this.device.supported) {
			this.pendingRepick = null;
			picker.click();
			return;
		}
		const folder = await this.device.pick();
		if (folder) this.addDeviceSource(folder);
	}

	protected useFiles(picker: HTMLInputElement): void {
		const repick = this.pendingRepick;
		this.pendingRepick = null;
		const folder = this.device.useFiles(picker.files, repick ?? undefined);
		picker.value = "";
		if (!folder) return;
		if (repick) {
			const source = this.sources().find((s) => s.id === repick);
			if (source) this.navigate([{ id: source.id, name: source.name }]);
			return;
		}
		this.addDeviceSource(folder);
	}

	private addDeviceSource(folder: PickedFolder): void {
		const source: Source = { id: folder.id, kind: "device", name: folder.name };
		this.sources.update((sources) => [...sources, source]);
		this.navigate([{ id: source.id, name: source.name }]);
	}

	protected removeSource(source: Source): void {
		if (!confirm(T().removeConfirm(source.name))) return;
		this.closeSettings();
		this.player.removeSource(source.id);
		this.sources.update((sources) => sources.filter((s) => s.id !== source.id));
		this.editing.set(null);
		if (source.kind === "device") this.device.remove(source.id);
		else {
			void clearCache();
			if (!this.sources().some((s) => s.account === source.account))
				void this.drive.removeAccount(source.account!);
		}
	}

	private restoreSession(): void {
		const session = this.session;
		if (!session || !this.player.synced()) return;
		if (this.player.remote()) {
			this.session = null;
			return;
		}
		const sources = this.sources();
		const tracks = session.tracks.filter((track) => sources.some((s) => s.id === track.source));
		const current = session.tracks[session.queue.order[session.queue.pos]];
		const source = sources.find((s) => s.id === current.source);
		if (!source) {
			if (this.drive.status() !== "loading" && this.storedSources !== null) this.session = null;
			return;
		}
		if (this.stateOf(source) !== "ready") return;
		this.session = null;
		if (tracks.length !== session.tracks.length) return;
		untracked(() =>
			this.player.restore(
				tracks.map((track) => ({ ...track, path: withRenamedRoot(track.path, sources) })),
				session.queue,
				session.time,
			),
		);
	}

	protected renameSource(source: Source, value: string): void {
		const name = value.trim();
		if (!name || name === source.name) return;
		this.sources.update((sources) => sources.map((s) => (s.id === source.id ? { ...s, name } : s)));
		this.path.update((path) => withRenamedRoot(path, this.sources()));
	}

	protected openSettings(source: Source): void {
		this.editing.set(source.id);
	}

	protected closeSettings(): void {
		this.settingsDialog()?.nativeElement.close();
		this.editing.set(null);
	}

	protected chooseTop(source: Source): void {
		if (source.kind !== "onedrive" || this.stateOf(source) !== "ready") return;
		this.closeSettings();
		this.navigate([{ id: source.id, name: source.name }], true);
	}

	protected useFolder(): void {
		const [root, ...folders] = this.path();
		if (!root) return;
		this.sources.update((sources) =>
			sources.map((s) => (s.id === root.id ? { ...s, root: folders.length ? folders : undefined } : s)),
		);
		this.show([root]);
		history.replaceState(this.navState(), "", this.navUrl());
	}

	protected cancelPicking(): void {
		this.navigate([]);
	}

	protected open(folder: DriveItem): void {
		this.navigate([...this.path(), { id: folder.id, name: folder.name }]);
	}

	protected goTo(depth: number): void {
		if (depth === this.path().length) return;
		this.navigate(this.path().slice(0, depth));
	}

	protected play(index: number): void {
		const track = this.tracks()[index];
		if (!track || !this.source()) return;
		if (this.player.current()?.id === track.id) {
			this.player.toggle();
			return;
		}
		this.player.playList(this.queued([track], this.path()), 0);
	}

	protected playAll(shuffle: boolean): void {
		const source = this.source();
		const tracks = this.tracks();
		if (!source || !tracks.length) return;
		if (this.player.shuffle() !== shuffle) this.player.toggleShuffle();
		this.player.playList(this.queued(tracks, this.path()), shuffle ? Math.floor(Math.random() * tracks.length) : 0);
	}

	protected addTrack(index: number): void {
		const track = this.tracks()[index];
		if (!track || !this.source()) return;
		this.player.enqueue(this.queued([track], this.path()));
		this.flash(T().addedToQueue(track.title));
	}

	protected addAll(): void {
		if (!this.source() || !this.tracks().length) return;
		this.player.enqueue(this.queued(this.tracks(), this.path()));
		this.flash(T().addedToQueue(this.path().at(-1)!.name));
	}

	protected async addFolderItem(folder: DriveItem): Promise<void> {
		const tracks = await this.folderTracks(folder);
		if (!tracks) return;
		this.player.enqueue(tracks);
		this.flash(T().addedToQueue(folder.name));
	}

	protected async playFolderItem(folder: DriveItem): Promise<void> {
		const tracks = await this.folderTracks(folder);
		if (!tracks) return;
		this.player.playList(tracks, 0);
	}

	private async folderTracks(folder: DriveItem): Promise<QueuedTrack[] | null> {
		const source = this.source();
		if (!source) return null;
		const path = [...this.path(), { id: folder.id, name: folder.name }];
		try {
			const items = await this.children(source, folder.id);
			const tracks = sortTracks(items).map(toTrack);
			if (!tracks.length) {
				this.flash(T().noTracks(folder.name));
				return null;
			}
			return this.queued(tracks, path);
		} catch (error) {
			console.error(error);
			this.flash(T().folderError);
			return null;
		}
	}

	private flash(message: string): void {
		this.added.set(message);
		clearTimeout(this.addedTimer);
		this.addedTimer = window.setTimeout(() => this.added.set(null), 2500);
	}

	protected openQueue(): void {
		this.queueOpen.set(true);
	}

	protected closeQueue(): void {
		this.queueDialog()?.nativeElement.close();
		this.queueOpen.set(false);
	}

	protected goPlayingFolder(): void {
		const path = this.playingPath();
		if (!path.length || this.inPlayingFolder()) return;
		this.revealTrack = true;
		this.navigate(path, false);
	}

	protected seek(event: Event): void {
		this.player.seek(Number((event.target as HTMLInputElement).value));
	}

	protected setTheme(theme: Theme): void {
		if (THEMES.includes(theme)) this.theme.set(theme);
	}
}
