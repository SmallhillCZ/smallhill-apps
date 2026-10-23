import { Injectable, computed, signal } from "@angular/core";

const TOKEN_KEY = "release-line.token";

export interface DeviceCode {
	deviceCode: string;
	userCode: string;
	verificationUri: string;
	expiresIn: number;
	interval: number;
}

export class AuthFailure extends Error {
	constructor(readonly kind: "offline" | "denied" | "expired" | "failed") {
		super(kind);
	}
}

function stored(): string | null {
	try {
		return localStorage.getItem(TOKEN_KEY);
	} catch {
		return null;
	}
}

@Injectable({ providedIn: "root" })
export class Auth {
	readonly token = signal<string | null>(stored());
	readonly signedIn = computed(() => !!this.token());
	readonly deviceFlow = signal<boolean | null>(null);

	constructor() {
		fetch("api/auth", { cache: "no-store" })
			.then((r) => (r.ok ? r.json() : { deviceFlow: false }))
			.then((r: { deviceFlow: boolean }) => this.deviceFlow.set(!!r.deviceFlow))
			.catch(() => this.deviceFlow.set(false));
	}

	setToken(token: string | null) {
		this.token.set(token);
		try {
			if (token) localStorage.setItem(TOKEN_KEY, token);
			else localStorage.removeItem(TOKEN_KEY);
		} catch {}
	}

	async startDevice(): Promise<DeviceCode> {
		const res = await this.post("api/device/code", {});
		if (!res.ok) throw new AuthFailure("failed");
		return (await res.json()) as DeviceCode;
	}

	async waitForDevice(code: DeviceCode, cancelled: () => boolean): Promise<string | null> {
		let interval = Math.max(code.interval || 5, 5);
		const until = Date.now() + (code.expiresIn || 900) * 1000;
		while (Date.now() < until) {
			await new Promise((r) => setTimeout(r, interval * 1000));
			if (cancelled()) return null;
			const res = await this.post("api/device/token", { deviceCode: code.deviceCode });
			if (!res.ok) throw new AuthFailure("failed");
			const body = (await res.json()) as { token?: string; error?: string; interval?: number };
			if (body.token) {
				this.setToken(body.token);
				return body.token;
			}
			if (body.error === "slow_down") interval = Math.max(interval + 5, body.interval ?? 0);
			else if (body.error === "access_denied") throw new AuthFailure("denied");
			else if (body.error === "expired_token") throw new AuthFailure("expired");
			else if (body.error !== "authorization_pending") throw new AuthFailure("failed");
		}
		throw new AuthFailure("expired");
	}

	private async post(url: string, body: unknown) {
		try {
			return await fetch(url, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body),
				cache: "no-store",
			});
		} catch {
			throw new AuthFailure("offline");
		}
	}
}
