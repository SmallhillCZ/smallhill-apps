import { applyTheme } from "./theme";

describe("theme", () => {
	let eink = false;
	const listeners: (() => void)[] = [];

	beforeAll(() => {
		globalThis.matchMedia = ((query: string) => ({
			media: query,
			get matches() {
				return eink;
			},
			addEventListener: (_: string, listener: () => void) => listeners.push(listener),
		})) as unknown as typeof matchMedia;
	});

	afterEach(() => localStorage.clear());

	it("follows the system when auto on a colour display", () => {
		eink = false;
		applyTheme("auto");
		expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
	});

	it("switches auto to eink on an e-ink display", () => {
		eink = true;
		listeners.forEach((listener) => listener());
		expect(document.documentElement.getAttribute("data-theme")).toBe("eink");
		eink = false;
		listeners.forEach((listener) => listener());
		expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
	});

	it("keeps a manually chosen theme on an e-ink display", () => {
		eink = true;
		applyTheme("dark");
		expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
		expect(localStorage.getItem("player.theme")).toBe("dark");
	});
});
