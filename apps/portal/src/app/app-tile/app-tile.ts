import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { AppActions } from "../app-actions/app-actions";
import { AppInfo } from "../apps";
import { onColor } from "../color";
import { T, tr } from "../i18n";

@Component({
	selector: "app-tile",
	imports: [AppActions],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./app-tile.html",
	host: { "[style.--app-color]": "app().color", "[style.--on-app-color]": "onColor(app().color)" },
	styleUrl: "./app-tile.scss",
})
export class AppTile {
	readonly app = input.required<AppInfo>();
	readonly details = output<void>();

	protected readonly t = T;
	protected readonly tr = tr;
	protected readonly onColor = onColor;
}
