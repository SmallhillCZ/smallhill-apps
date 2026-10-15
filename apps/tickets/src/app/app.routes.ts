import { Routes } from "@angular/router";

export const routes: Routes = [
	{ path: "", loadComponent: () => import("./home/home").then((m) => m.Home) },
	{ path: "t/:id", loadComponent: () => import("./ticket/ticket-page").then((m) => m.TicketPage) },
	{ path: "**", redirectTo: "" },
];
