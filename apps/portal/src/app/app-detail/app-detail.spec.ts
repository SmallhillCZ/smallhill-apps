import { APPS } from "../apps";
import { shareUrl } from "./app-detail";

describe("shareUrl", () => {
	it("points to the app's share page next to the portal", () => {
		expect(shareUrl(APPS[0])).toBe(new URL(`app/${APPS[0].id}/`, document.baseURI).href);
	});
});
