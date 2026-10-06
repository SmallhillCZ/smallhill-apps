export type AuthStatus = "loading" | "unconfigured" | "ready" | "error";

export interface DriveAccount {
	id: string;
	name: string;
	username: string;
}
