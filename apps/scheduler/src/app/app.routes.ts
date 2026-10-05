import { Routes } from "@angular/router";

export const routes: Routes = [
	{ path: "", loadComponent: () => import("./home/home").then((m) => m.Home), title: "Scheduler" },
	{
		path: "new",
		loadComponent: () => import("./poll-form/poll-form").then((m) => m.PollForm),
		title: "New poll · Scheduler",
	},
	{ path: "p/:id", loadComponent: () => import("./poll/poll-page").then((m) => m.PollPage) },
	{
		path: "p/:id/edit",
		loadComponent: () => import("./poll-form/poll-form").then((m) => m.PollForm),
		title: "Edit poll · Scheduler",
	},
	{ path: "**", redirectTo: "" },
];
