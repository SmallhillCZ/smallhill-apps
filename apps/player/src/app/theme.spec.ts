import { applyTheme, loadTheme } from "./theme";

describe("theme", () => {
	afterEach(() => localStorage.clear());

	it("follows the system when auto", () => {
		applyTheme("auto");
		expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
		expect(loadTheme()).toBe("auto");
	});

	it("remembers a manually chosen theme", () => {
		applyTheme("dark");
		expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
		expect(loadTheme()).toBe("dark");
	});
});
