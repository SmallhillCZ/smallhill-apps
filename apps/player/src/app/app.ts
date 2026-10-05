import {
	afterRenderEffect,
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	inject,
	signal,
	viewChild,
} from "@angular/core";
import { DeviceService } from "./device/device.service";
import { lang, LANGS, setLang, T } from "./i18n";
import { Icon } from "./icon";
import { cacheChildren, cachedChildren, clearCache } from "./onedrive/folder-cache";
import {
	Library,
	loadLibrary,
	loadPaths,
	loadSource,
	samePath,
	saveLibrary,
	savePaths,
	saveSource,
	SourceId,
} from "./library";
import { DriveItem, Folder, formatTime, sortFolders, sortTracks, toTrack, Track } from "./onedrive/items";
import { OneDriveService } from "./onedrive/onedrive.service";
import { PlayerService } from "./player/player.service";
import { applyTheme, loadTheme, Theme, THEMES } from "./theme";

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

	protected readonly library = signal<Library | null>(loadLibrary());
	protected readonly source = signal<SourceId>(this.library()?.source ?? loadSource());
	private readonly paths = signal(this.initialPaths());
	protected readonly path = computed(() => this.paths()[this.source()]);
	protected readonly ready = computed(() =>
		this.source() === "onedrive" ? this.drive.status() === "signedIn" : this.device.status() === "ready",
	);
	protected readonly items = signal<DriveItem[]>([]);
	protected readonly loading = signal(false);
	protected readonly failed = signal(false);
	private request = 0;
	private readonly crumbs = viewChild<ElementRef<HTMLElement>>("crumbs");

	protected readonly folders = computed(() => sortFolders(this.items()));
	protected readonly tracks = computed<Track[]>(() => sortTracks(this.items()).map(toTrack));
	protected readonly folderId = computed(() => this.path().at(-1)?.id ?? null);
	protected readonly isLibrary = computed(() => {
		const library = this.library();
		return !!library && library.source === this.source() && samePath(library.path, this.path());
	});
	protected readonly progress = computed(() => {
		const duration = this.player.duration();
		return duration ? Math.min(100, (this.player.time() / duration) * 100) : 0;
	});

	constructor() {
		effect(() => applyTheme(this.theme()));
		effect(() => (document.documentElement.lang = lang()));
		effect(() => (document.title = T().title));
		effect(() => savePaths(this.paths()));
		effect(() => saveLibrary(this.library()));
		effect(() => saveSource(this.source()));
		afterRenderEffect(() => {
			this.path();
			const crumbs = this.crumbs()?.nativeElement;
			if (crumbs) crumbs.scrollLeft = crumbs.scrollWidth;
		});
		effect(() => {
			if (this.ready()) void this.load(this.source(), this.folderId());
		});
	}

	private initialPaths() {
		const paths = loadPaths();
		const library = this.library();
		if (library) paths[library.source] = library.path;
		return paths;
	}

	private setPath(path: Folder[]): void {
		this.items.set([]);
		this.paths.update((paths) => ({ ...paths, [this.source()]: path }));
	}

	protected async load(source: SourceId, folderId: string | null): Promise<void> {
		const request = ++this.request;
		this.failed.set(false);
		const cached = source === "onedrive" ? await cachedChildren(folderId) : null;
		if (request !== this.request) return;
		if (cached) this.items.set(cached);
		this.loading.set(!cached);
		try {
			const items = await (source === "onedrive" ? this.drive : this.device).children(folderId);
			if (request !== this.request) return;
			this.items.set(items);
			if (source === "onedrive") void cacheChildren(folderId, items);
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

	protected setSource(source: SourceId): void {
		if (source === this.source()) return;
		this.items.set([]);
		this.source.set(source);
	}

	protected toggleLibrary(): void {
		if (this.isLibrary()) {
			this.library.set(null);
			return;
		}
		const library: Library = { source: this.source(), path: this.path() };
		if (this.source() === "device") library.root = this.device.rootName() ?? undefined;
		this.library.set(library);
	}

	protected goLibrary(): void {
		const library = this.library();
		if (!library) return;
		this.setSource(library.source);
		this.setPath(library.path);
	}

	protected open(folder: DriveItem): void {
		this.setPath([...this.path(), { id: folder.id, name: folder.name }]);
	}

	protected goTo(depth: number): void {
		if (depth === this.path().length) return;
		this.setPath(this.path().slice(0, depth));
	}

	protected async chooseFolder(input: HTMLInputElement): Promise<void> {
		if (!this.device.supported) {
			input.click();
			return;
		}
		if (await this.device.choose()) this.afterChoose();
	}

	protected useFiles(input: HTMLInputElement): void {
		if (this.device.useFiles(input.files)) this.afterChoose();
		input.value = "";
	}

	private afterChoose(): void {
		const library = this.library();
		if (library?.source !== "device") {
			this.setPath([]);
			return;
		}
		const same = library.root === this.device.rootName();
		this.setPath(same ? library.path : []);
		if (!same) this.library.set(null);
	}

	protected currentSource() {
		return this.source() === "onedrive" ? this.drive : this.device;
	}

	protected play(index: number): void {
		const track = this.tracks()[index];
		if (this.player.current()?.id === track.id) {
			this.player.toggle();
			return;
		}
		this.player.playList(this.tracks(), index, this.currentSource());
	}

	protected playAll(shuffle: boolean): void {
		const tracks = this.tracks();
		if (!tracks.length) return;
		if (this.player.shuffle() !== shuffle) this.player.toggleShuffle();
		this.player.playList(tracks, shuffle ? Math.floor(Math.random() * tracks.length) : 0, this.currentSource());
	}

	protected seek(event: Event): void {
		this.player.seek(Number((event.target as HTMLInputElement).value));
	}

	protected setTheme(theme: Theme): void {
		if (THEMES.includes(theme)) this.theme.set(theme);
	}

	protected signOut(): void {
		if (this.player.isFrom(this.drive)) this.player.stop();
		const library = this.library();
		this.paths.update((paths) => ({ ...paths, onedrive: library?.source === "onedrive" ? library.path : [] }));
		void clearCache();
		void this.drive.signOut();
	}
}
