import { Injectable, signal } from "@angular/core";
import type { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { AUTHORITY, CLIENT_ID, GRAPH, SCOPES } from "../config";
import { AuthStatus } from "./auth-status";
import { DriveItem } from "./items";

const SELECT = "id,name,size,folder,file,audio";

@Injectable({ providedIn: "root" })
export class OneDriveService {
	readonly status = signal<AuthStatus>("loading");
	readonly accountName = signal<string | null>(null);

	private msal: IPublicClientApplication | null = null;
	private account: AccountInfo | null = null;
	private readonly ready: Promise<void>;

	constructor() {
		this.ready = this.init();
	}

	private async init(): Promise<void> {
		if (!CLIENT_ID) {
			this.status.set("unconfigured");
			return;
		}
		try {
			const { createStandardPublicClientApplication } = await import("@azure/msal-browser");
			const redirectUri = new URL(".", document.baseURI).href;
			const msal = await createStandardPublicClientApplication({
				auth: { clientId: CLIENT_ID, authority: AUTHORITY, redirectUri, postLogoutRedirectUri: redirectUri },
				cache: { cacheLocation: "localStorage" },
			});
			this.msal = msal;
			const result = await msal.handleRedirectPromise();
			this.setAccount(result?.account ?? msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null);
		} catch (error) {
			console.error(error);
			this.status.set("error");
		}
	}

	private setAccount(account: AccountInfo | null): void {
		this.account = account;
		this.msal?.setActiveAccount(account);
		this.accountName.set(account ? account.name || account.username : null);
		this.status.set(account ? "signedIn" : "signedOut");
	}

	async signIn(): Promise<void> {
		await this.ready;
		await this.msal?.loginRedirect({ scopes: SCOPES, prompt: "select_account" });
	}

	async signOut(): Promise<void> {
		await this.ready;
		if (!this.msal) return;
		const account = this.account;
		this.setAccount(null);
		await this.msal.logoutRedirect({ account });
	}

	async children(folderId: string | null): Promise<DriveItem[]> {
		const path = folderId ? `/me/drive/items/${encodeURIComponent(folderId)}/children` : "/me/drive/root/children";
		let url: string | undefined = `${GRAPH}${path}?$select=${SELECT}&$top=500`;
		const items: DriveItem[] = [];
		while (url) {
			const page: { value: DriveItem[]; "@odata.nextLink"?: string } = await this.get(url);
			items.push(...page.value);
			url = page["@odata.nextLink"];
		}
		return items;
	}

	async downloadUrl(id: string): Promise<string> {
		const item = await this.get<Record<string, string>>(
			`${GRAPH}/me/drive/items/${encodeURIComponent(id)}?$select=id,@microsoft.graph.downloadUrl`,
		);
		return item["@microsoft.graph.downloadUrl"];
	}

	private async get<T>(url: string): Promise<T> {
		const response = await fetch(url, { headers: { Authorization: `Bearer ${await this.token()}` } });
		if (!response.ok) throw new Error(`Graph ${response.status}`);
		return response.json() as Promise<T>;
	}

	private async token(): Promise<string> {
		await this.ready;
		if (!this.msal || !this.account) throw new Error("Not signed in");
		const { InteractionRequiredAuthError } = await import("@azure/msal-browser");
		try {
			const result = await this.msal.acquireTokenSilent({ scopes: SCOPES, account: this.account });
			return result.accessToken;
		} catch (error) {
			if (error instanceof InteractionRequiredAuthError) {
				await this.msal.acquireTokenRedirect({ scopes: SCOPES, account: this.account });
			}
			throw error;
		}
	}
}
