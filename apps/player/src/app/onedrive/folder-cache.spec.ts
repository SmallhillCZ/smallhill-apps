import { cacheChildren, cachedChildren, clearCache } from "./folder-cache";

describe("folder cache", () => {
	it("works without IndexedDB", async () => {
		await cacheChildren(null, [{ id: "1", name: "Music", folder: { childCount: 1 } }]);
		expect(await cachedChildren(null)).toBeNull();
		await clearCache();
	});
});
