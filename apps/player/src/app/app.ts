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
import { lang, LANGS, setLang, T } from "./i18n";
import { Icon } from "./icon";
import { DriveItem, Folder, formatTime, sortFolders, sortTracks, toTrack, Track } from "./onedrive/items";
import { OneDriveService } from "./onedrive/onedrive.service";
import { PlayerService } from "./player/player.service";
import { applyTheme, loadTheme, Theme, THEMES } from "./theme";

const PATH_KEY = "player.path";

function loadPath(): Folder[] {
	try {
		const stored = JSON.parse(localStorage.getItem(PATH_KEY) ?? "[]") as Folder[];
		return Array.isArray(stored)
			? stored.filter((f) => typeof f?.id === "string" && typeof f?.name === "string")
			: [];
	} catch {
		return [];
	}
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
	protected readonly player = inject(PlayerService);
	protected readonly t = T;
	protected readonly lang = lang;
	protected readonly langs = LANGS;
	protected readonly setLang = setLang;
	protected readonly themes = THEMES;
	protected readonly theme = signal<Theme>(loadTheme());
	protected readonly formatTime = formatTime;

	protected readonly path = signal<Folder[]>(loadPath());
	protected readonly items = signal<DriveItem[]>([]);
	protected readonly loading = signal(false);
	protected readonly failed = signal(false);
	private request = 0;
	private readonly crumbs = viewChild<ElementRef<HTMLElement>>("crumbs");

	protected readonly folders = computed(() => sortFolders(this.items()));
	protected readonly tracks = computed<Track[]>(() => sortTracks(this.items()).map(toTrack));
	protected readonly folderId = computed(() => this.path().at(-1)?.id ?? null);
	protected readonly progress = computed(() => {
		const duration = this.player.duration();
		return duration ? Math.min(100, (this.player.time() / duration) * 100) : 0;
	});

	constructor() {
		effect(() => applyTheme(this.theme()));
		effect(() => (document.documentElement.lang = lang()));
		effect(() => (document.title = T().title));
		effect(() => {
			try {
				localStorage.setItem(PATH_KEY, JSON.stringify(this.path()));
			} catch {}
		});
		afterRenderEffect(() => {
			this.path();
			const crumbs = this.crumbs()?.nativeElement;
			if (crumbs) crumbs.scrollLeft = crumbs.scrollWidth;
		});
		effect(() => {
			if (this.drive.status() === "signedIn") void this.load(this.folderId());
		});
	}

	protected async load(folderId: string | null): Promise<void> {
		const request = ++this.request;
		this.loading.set(true);
		this.failed.set(false);
		try {
			const items = await this.drive.children(folderId);
			if (request !== this.request) return;
			this.items.set(items);
		} catch (error) {
			if (request !== this.request) return;
			console.error(error);
			this.items.set([]);
			this.failed.set(true);
		} finally {
			if (request === this.request) this.loading.set(false);
		}
	}

	protected open(folder: DriveItem): void {
		this.items.set([]);
		this.path.update((path) => [...path, { id: folder.id, name: folder.name }]);
	}

	protected goTo(depth: number): void {
		if (depth === this.path().length) return;
		this.items.set([]);
		this.path.update((path) => path.slice(0, depth));
	}

	protected play(index: number): void {
		const track = this.tracks()[index];
		if (this.player.current()?.id === track.id) {
			this.player.toggle();
			return;
		}
		this.player.playList(this.tracks(), index);
	}

	protected playAll(shuffle: boolean): void {
		const tracks = this.tracks();
		if (!tracks.length) return;
		if (this.player.shuffle() !== shuffle) this.player.toggleShuffle();
		this.player.playList(tracks, shuffle ? Math.floor(Math.random() * tracks.length) : 0);
	}

	protected seek(event: Event): void {
		this.player.seek(Number((event.target as HTMLInputElement).value));
	}

	protected setTheme(theme: Theme): void {
		if (THEMES.includes(theme)) this.theme.set(theme);
	}

	protected signOut(): void {
		this.player.stop();
		this.path.set([]);
		void this.drive.signOut();
	}
}
