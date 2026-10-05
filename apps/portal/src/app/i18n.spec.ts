import { detectLang } from "./i18n";

describe("detectLang", () => {
	it("picks Czech from the system languages", () => {
		expect(detectLang(["cs-CZ", "en-US"])).toBe("cs");
		expect(detectLang(["de-DE", "cs"])).toBe("cs");
	});

	it("treats Slovak as Czech", () => {
		expect(detectLang(["sk-SK"])).toBe("cs");
	});

	it("uses the first supported language", () => {
		expect(detectLang(["de-DE", "en-GB", "cs-CZ"])).toBe("en");
	});

	it("falls back to English", () => {
		expect(detectLang(["de-DE", "fr"])).toBe("en");
		expect(detectLang([])).toBe("en");
	});
});
