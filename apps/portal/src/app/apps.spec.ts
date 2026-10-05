import { APPS } from "./apps";

describe("APPS", () => {
	it("has unique ids", () => {
		expect(new Set(APPS.map((app) => app.id)).size).toBe(APPS.length);
	});

	it("has every text in both languages", () => {
		for (const app of APPS) {
			for (const text of [app.name, app.tagline, app.description]) {
				expect(text.en.trim()).not.toBe("");
				expect(text.cs.trim()).not.toBe("");
			}
		}
	});

	it("uses app paths with trailing slash", () => {
		for (const app of APPS.filter((app) => app.url)) {
			expect(app.url).toMatch(/^\/[a-z0-9-]+\/$/);
		}
	});
});
