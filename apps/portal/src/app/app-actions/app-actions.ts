import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";
import { AppInfo } from "../apps";
import { T } from "../i18n";
import { InstallService } from "../install.service";

@Component({
	selector: "app-actions",
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./app-actions.html",
	styleUrl: "./app-actions.scss",
	host: { "[class.large]": "large()" },
})
export class AppActions {
	readonly app = input.required<AppInfo>();
	readonly large = input(false);
	readonly help = output<void>();

	protected readonly installer = inject(InstallService);
	protected readonly t = T;
	protected readonly state = computed(() => this.installer.state(this.app()));

	protected async install(): Promise<void> {
		if ((await this.installer.install(this.app())) === "help") this.help.emit();
	}
}
