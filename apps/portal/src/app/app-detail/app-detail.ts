import { ChangeDetectionStrategy, Component, computed, inject, input, output } from "@angular/core";
import { AppActions } from "../app-actions/app-actions";
import { AppInfo } from "../apps";
import { T, tr } from "../i18n";
import { InstallService } from "../install.service";

@Component({
	selector: "app-detail",
	imports: [AppActions],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./app-detail.html",
	styleUrl: "./app-detail.scss",
})
export class AppDetail {
	readonly app = input.required<AppInfo>();
	readonly closed = output<void>();

	protected readonly t = T;
	protected readonly tr = tr;
	private readonly installer = inject(InstallService);
	protected readonly showHelp = computed(() => this.installer.state(this.app()) === "help");
}
