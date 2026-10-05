import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";
import { AppActions } from "../app-actions/app-actions";
import { AppInfo } from "../apps";
import { onColor } from "../color";
import { T, tr } from "../i18n";
import { InstallService } from "../install.service";

@Component({
	selector: "app-detail",
	imports: [AppActions],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./app-detail.html",
	host: { "[style.--app-color]": "app().color", "[style.--on-app-color]": "onColor(app().color)" },
	styleUrl: "./app-detail.scss",
})
export class AppDetail {
	readonly app = input.required<AppInfo>();
	readonly closed = output<void>();

	protected readonly t = T;
	protected readonly tr = tr;
	protected readonly onColor = onColor;
	private readonly installer = inject(InstallService);
	protected readonly showHelp = computed(() => this.installer.state(this.app()) === "help");
}
