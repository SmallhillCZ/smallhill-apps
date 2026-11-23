import { Injectable, signal } from "@angular/core";
import type { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { extensionOf } from "./library";
import type { Drive, RemoteIndex, RemoteState, SyncedMeta } from "./sync";

export const CLIENT_ID = "a3e7e477-7aba-4c4b-a605-726a61e06edc";
const AUTHORITY = "https://login.microsoftonline.com/common";
const SCOPES = ["Files.ReadWrite.AppFolder"];
const GRAPH = "https://graph.microsoft.com/v1.0";
const ROOT = "memes";
const SIMPLE_UPLOAD_LIMIT = 4 * 1024 * 1024;
const CHUNK = 320 * 1024 * 10;
const ACCOUNT_KEY = "memes.onedrive.account";

export type DriveStatus = "loading" | "signedOut" | "signedIn" | "error";

export interface DriveAccount {
	id: string;
	name: string;
	username: string;
}

class GraphError extends Error {
	constructor(readonly status: number) {
		super(`Graph ${status}`);
	}
}

function path(...segments: string[]): string {
	return [ROOT, ...segments].map(encodeURIComponent).join("/");
}

export function remoteFileName(meme: Pick<SyncedMeta, "id" | "type" | "name">): string {
	return `${meme.id}.${extensionOf(meme.type, meme.name)}`;
}

@Injectable({ providedIn: "root" })
export class OneDrive implements Drive {
	readonly status = signal<DriveStatus>("loading");
	readonly account = signal<DriveAccount | null>(null);

	private msal: IPublicClientApplication | null = null;
	private readonly ready: Promise<void>;

	constructor() {
		this.ready = this.init();
	}

	private async init(): Promise<void> {
		const wanted = localStorage.getItem(ACCOUNT_KEY);
		const returning = /[#&?](code|error|state)=/.test(location.hash + location.search);
		if (!wanted && !returning) {
			this.status.set("signedOut");
			return;
		}
		try {
			await this.client();
			const result = await this.msal!.handleRedirectPromise();
			const account = result?.account ?? (wanted ? this.msal!.getAccount({ homeAccountId: wanted }) : null);
			this.setAccount(account);
		} catch (error) {
			console.error(error);
			this.status.set("error");
		}
	}

	private async client(): Promise<IPublicClientApplication> {
		if (this.msal) return this.msal;
		const { createStandardPublicClientApplication } = await import("@azure/msal-browser");
		const redirectUri = new URL(".", document.baseURI).href;
		this.msal = await createStandardPublicClientApplication({
			auth: { clientId: CLIENT_ID, authority: AUTHORITY, redirectUri, postLogoutRedirectUri: redirectUri },
			cache: { cacheLocation: "localStorage" },
		});
		return this.msal;
	}

	private setAccount(account: AccountInfo | null) {
		if (account) {
			localStorage.setItem(ACCOUNT_KEY, account.homeAccountId);
			this.account.set({
				id: account.homeAccountId,
				name: account.name || account.username,
				username: account.username,
			});
			this.status.set("signedIn");
		} else {
			localStorage.removeItem(ACCOUNT_KEY);
			this.account.set(null);
			this.status.set("signedOut");
		}
	}

	async signIn(): Promise<void> {
		const msal = await this.client();
		await msal.loginRedirect({ scopes: SCOPES, prompt: "select_account" });
	}

	async signOut(): Promise<void> {
		await this.ready;
		const account = this.msalAccount();
		if (account && this.msal) await this.msal.clearCache({ account });
		this.setAccount(null);
	}

	async readIndex(): Promise<RemoteState> {
		const response = await this.fetch(`/me/drive/special/approot:/${path("library.json")}`);
		if (response.status === 404) return { index: null, etag: null };
		if (!response.ok) throw new GraphError(response.status);
		const item = (await response.json()) as Record<string, string>;
		const content = await this.content(item);
		const index = JSON.parse(await content.text()) as RemoteIndex;
		if (!Array.isArray(index?.memes)) throw new Error("bad index");
		return { index: { version: 1, memes: index.memes, deleted: index.deleted ?? {} }, etag: item["eTag"] ?? null };
	}

	async writeIndex(index: RemoteIndex, etag: string | null): Promise<"ok" | "conflict"> {
		const query = etag ? "" : "?@microsoft.graph.conflictBehavior=fail";
		const response = await this.fetch(`/me/drive/special/approot:/${path("library.json")}:/content${query}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json", ...(etag ? { "If-Match": etag } : {}) },
			body: JSON.stringify(index),
		});
		if (response.status === 412 || response.status === 409) return "conflict";
		if (!response.ok) throw new GraphError(response.status);
		return "ok";
	}

	async upload(meme: SyncedMeta, blob: Blob): Promise<void> {
		const target = `/me/drive/special/approot:/${path("files", remoteFileName(meme))}`;
		if (blob.size <= SIMPLE_UPLOAD_LIMIT) {
			const response = await this.fetch(`${target}:/content`, {
				method: "PUT",
				headers: { "Content-Type": meme.type },
				body: blob,
			});
			if (!response.ok) throw new GraphError(response.status);
			return;
		}
		const session = await this.fetch(`${target}:/createUploadSession`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "replace" } }),
		});
		if (!session.ok) throw new GraphError(session.status);
		const { uploadUrl } = (await session.json()) as { uploadUrl: string };
		for (let start = 0; start < blob.size; start += CHUNK) {
			const end = Math.min(start + CHUNK, blob.size);
			const response = await fetch(uploadUrl, {
				method: "PUT",
				headers: { "Content-Range": `bytes ${start}-${end - 1}/${blob.size}` },
				body: blob.slice(start, end),
			});
			if (!response.ok) throw new GraphError(response.status);
		}
	}

	async download(meme: SyncedMeta): Promise<Blob> {
		const response = await this.fetch(`/me/drive/special/approot:/${path("files", remoteFileName(meme))}`);
		if (!response.ok) throw new GraphError(response.status);
		const blob = await this.content((await response.json()) as Record<string, string>);
		return new Blob([blob], { type: meme.type });
	}

	async remove(meme: SyncedMeta): Promise<void> {
		const response = await this.fetch(`/me/drive/special/approot:/${path("files", remoteFileName(meme))}`, {
			method: "DELETE",
		});
		if (!response.ok && response.status !== 404) throw new GraphError(response.status);
	}

	private async content(item: Record<string, string>): Promise<Blob> {
		const url = item["@microsoft.graph.downloadUrl"];
		const response = url
			? await fetch(url)
			: await this.fetch(`/me/drive/items/${encodeURIComponent(item["id"])}/content`);
		if (!response.ok) throw new GraphError(response.status);
		return response.blob();
	}

	private msalAccount(): AccountInfo | null {
		const id = this.account()?.id;
		return id ? (this.msal?.getAccount({ homeAccountId: id }) ?? null) : null;
	}

	private async fetch(url: string, init: RequestInit = {}): Promise<Response> {
		const token = await this.token();
		return fetch(`${GRAPH}${url}`, {
			...init,
			cache: "no-store",
			headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
		});
	}

	private async token(): Promise<string> {
		await this.ready;
		const account = this.msalAccount();
		if (!this.msal || !account) throw new Error("Not signed in");
		const { InteractionRequiredAuthError } = await import("@azure/msal-browser");
		try {
			return (await this.msal.acquireTokenSilent({ scopes: SCOPES, account })).accessToken;
		} catch (error) {
			if (error instanceof InteractionRequiredAuthError) {
				await this.msal.acquireTokenRedirect({ scopes: SCOPES, account });
			}
			throw error;
		}
	}
}
