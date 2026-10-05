import { TestBed } from "@angular/core/testing";
import { AppInfo } from "./apps";
import { InstallService } from "./install.service";

const app: AppInfo = {
	id: "demo",
	name: { en: "Demo", cs: "Demo" },
	tagline: { en: "", cs: "" },
	description: { en: "", cs: "" },
	color: "#000000",
	icon: "",
	screenshots: [],
	url: "/demo/",
	listed: true,
};

function setInstall(install: unknown): void {
	Object.defineProperty(navigator, "install", { value: install, configurable: true });
}

describe("InstallService", () => {
	afterEach(() => setInstall(undefined));

	it("shows help when navigator.install is missing", async () => {
		setInstall(undefined);
		const service = TestBed.inject(InstallService);
		expect(await service.install(app)).toBe("help");
		expect(service.state(app)).toBe("help");
	});

	it("installs the app by its absolute url", async () => {
		const install = vi.fn().mockResolvedValue({ manifest_id: "x" });
		setInstall(install);
		const service = TestBed.inject(InstallService);
		await service.install(app);
		const url = new URL("/demo/", document.baseURI).href;
		expect(install).toHaveBeenCalledWith(url, url);
		expect(service.state(app)).toBe("installed");
	});

	it("returns to idle when the user cancels", async () => {
		setInstall(vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError")));
		const service = TestBed.inject(InstallService);
		await service.install(app);
		expect(service.state(app)).toBe("idle");
	});
});
