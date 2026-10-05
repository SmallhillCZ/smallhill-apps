import { DecimalPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

const RANGE = 50;
const SWEEP = 60;

@Component({
	selector: "app-gauge",
	imports: [DecimalPipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./gauge.html",
	styleUrl: "./gauge.scss",
	host: { "[class.in-tune]": "inTune()", "[class.active]": "cents() !== null" },
})
export class Gauge {
	readonly cents = input<number | null>(null);
	readonly tolerance = input(5);

	protected readonly ticks = Array.from({ length: 11 }, (_, i) => {
		const value = -RANGE + i * 10;
		return { value, angle: (value / RANGE) * SWEEP, major: value % 50 === 0 || value === 0 };
	});

	protected readonly toleranceArc = computed(() => this.arc(-this.tolerance(), this.tolerance()));
	protected readonly fullArc = this.arc(-RANGE, RANGE);

	protected readonly angle = computed(() => {
		const cents = this.cents() ?? 0;
		return (Math.max(-RANGE, Math.min(RANGE, cents)) / RANGE) * SWEEP;
	});

	protected readonly inTune = computed(() => {
		const cents = this.cents();
		return cents !== null && Math.abs(cents) <= this.tolerance();
	});

	private arc(from: number, to: number): string {
		const r = 90;
		const point = (cents: number) => {
			const a = (((cents / RANGE) * SWEEP - 90) * Math.PI) / 180;
			return `${100 + r * Math.cos(a)} ${110 + r * Math.sin(a)}`;
		};
		return `M ${point(from)} A ${r} ${r} 0 0 1 ${point(to)}`;
	}
}
