import { Injectable, signal } from "@angular/core";
import type { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { AUTHORITY, CLIENT_ID, GRAPH, SCOPES } from "../config";
import { AuthStatus, DriveAccount } from "./auth-status";
import { DriveItem } from "./items";

const SELECT = "id,name,size,folder,file,audio";

const toAccount = (account: AccountInfo): DriveAccount => ({
	id: account.homeAccountId,
	name: account.name || account.username,
	username: account.username,
});

@Injectable({ providedIn: "root" })
export class OneDriveService {
	readonly status = signal<AuthStatus>("loading");
	readonly accounts = signal<DriveAccount[]>([]);
	readonly signedIn = signal<DriveAccount | null>(null);

	private msal: IPublicClientApplication | null = null;
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
			this.refresh();
			if (result?.account) this.signedIn.set(toAccount(result.account));
			this.status.set("ready");
		} catch (error) {
			console.error(error);
			this.status.set("error");
		}
	}

	private refresh(): void {
		this.accounts.set(this.msal?.getAllAccounts().map(toAccount) ?? []);
	}

	async addAccount(): Promise<void> {
		await this.ready;
		await this.msal?.loginRedirect({ scopes: SCOPES, prompt: "select_account" });
	}

	async signIn(accountId: string): Promise<void> {
		await this.ready;
		const account = this.account(accountId);
		await this.msal?.loginRedirect({
			scopes: SCOPES,
			...(account ? { account } : { prompt: "select_account" }),
		});
	}

	async removeAccount(accountId: string): Promise<void> {
		await this.ready;
		const account = this.account(accountId);
		if (account) await this.msal?.clearCache({ account });
		this.refresh();
	}

	async children(accountId: string, folderId: string | null): Promise<DriveItem[]> {
		const path = folderId ? `/me/drive/items/${encodeURIComponent(folderId)}/children` : "/me/drive/root/children";
		let url: string | undefined = `${GRAPH}${path}?$select=${SELECT}&$top=500`;
		const items: DriveItem[] = [];
		while (url) {
			const page: { value: DriveItem[]; "@odata.nextLink"?: string } = await this.get(accountId, url);
			items.push(...page.value);
			url = page["@odata.nextLink"];
		}
		return items;
	}

	async downloadUrl(accountId: string, id: string): Promise<string> {
		const item = await this.get<Record<string, string | undefined>>(
			accountId,
			`${GRAPH}/me/drive/items/${encodeURIComponent(id)}`,
		);
		const url = item["@microsoft.graph.downloadUrl"];
		if (url) return url;
		const response = await fetch(`${GRAPH}/me/drive/items/${encodeURIComponent(id)}/content`, {
			headers: { Authorization: `Bearer ${await this.token(accountId)}` },
		});
		if (!response.ok) throw new Error(`Graph ${response.status}`);
		return URL.createObjectURL(await response.blob());
	}

	private account(accountId: string): AccountInfo | null {
		return this.msal?.getAccount({ homeAccountId: accountId }) ?? null;
	}

	private async get<T>(accountId: string, url: string): Promise<T> {
		const response = await fetch(url, { headers: { Authorization: `Bearer ${await this.token(accountId)}` } });
		if (!response.ok) throw new Error(`Graph ${response.status}`);
		return response.json() as Promise<T>;
	}

	private async token(accountId: string): Promise<string> {
		await this.ready;
		const account = this.account(accountId);
		if (!this.msal || !account) throw new Error("Not signed in");
		const { InteractionRequiredAuthError } = await import("@azure/msal-browser");
		try {
			const result = await this.msal.acquireTokenSilent({ scopes: SCOPES, account });
			return result.accessToken;
		} catch (error) {
			if (error instanceof InteractionRequiredAuthError) {
				await this.msal.acquireTokenRedirect({ scopes: SCOPES, account });
			}
			throw error;
		}
	}
}
