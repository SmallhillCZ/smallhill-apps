import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, signal, viewChild } from "@angular/core";
import { AppDetail } from "./app-detail/app-detail";
import { AppTile } from "./app-tile/app-tile";
import { APPS } from "./apps";
import { Lang, lang, setLang, T } from "./i18n";

@Component({
	selector: "app-root",
	imports: [AppTile, AppDetail],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./app.html",
	styleUrl: "./app.scss",
	host: {
		"(window:hashchange)": "syncFromHash()",
		"(document:keydown)": "keyboard = true",
		"(document:pointerdown)": "keyboard = false",
	},
})
export class App {
	protected readonly t = T;
	protected readonly lang = lang;
	protected readonly langs: Lang[] = ["cs", "en"];
	protected readonly setLang = setLang;
	protected readonly apps = APPS.filter((app) => app.listed);

	private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>("dialog");
	protected readonly selectedId = signal<string | null>(null);
	protected readonly selected = computed(() => this.apps.find((app) => app.id === this.selectedId()) ?? null);

	constructor() {
		this.syncFromHash();
		effect(() => {
			document.documentElement.lang = lang();
		});
		effect(() => {
			const dialog = this.dialog().nativeElement;
			if (this.selected() && !dialog.open) dialog.showModal();
			if (!this.selected() && dialog.open) dialog.close();
		});
	}

	protected syncFromHash(): void {
		const id = decodeURIComponent(location.hash.slice(1));
		this.selectedId.set(this.apps.some((app) => app.id === id) ? id : null);
	}

	protected open(id: string): void {
		history.replaceState(null, "", `#${id}`);
		this.selectedId.set(id);
	}

	protected close(): void {
		history.replaceState(null, "", location.pathname + location.search);
		this.selectedId.set(null);
	}

	protected keyboard = false;

	protected onClose(): void {
		if (!this.keyboard && document.activeElement instanceof HTMLElement) document.activeElement.blur();
		if (this.selected()) this.close();
	}

	protected onBackdropClick(event: MouseEvent): void {
		if (event.target === this.dialog().nativeElement) this.close();
	}
}
