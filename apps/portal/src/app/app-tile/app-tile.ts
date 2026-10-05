import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { AppActions } from "../app-actions/app-actions";
import { AppInfo } from "../apps";
import { T, tr } from "../i18n";

@Component({
	selector: "app-tile",
	imports: [AppActions],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./app-tile.html",
	styleUrl: "./app-tile.scss",
})
export class AppTile {
	readonly app = input.required<AppInfo>();
	readonly details = output<void>();

	protected readonly t = T;
	protected readonly tr = tr;
}
