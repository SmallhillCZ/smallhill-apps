import { inject } from "@angular/core";
import { Routes } from "@angular/router";
import { I18n } from "./i18n";

const titled = (key: "newPoll" | "editPoll") => () => `${inject(I18n).t()[key]} · Scheduler`;

export const routes: Routes = [
	{ path: "", loadComponent: () => import("./home/home").then((m) => m.Home), title: "Scheduler" },
	{
		path: "new",
		loadComponent: () => import("./poll-form/poll-form").then((m) => m.PollForm),
		title: titled("newPoll"),
	},
	{ path: "p/:id", loadComponent: () => import("./poll/poll-page").then((m) => m.PollPage) },
	{
		path: "p/:id/edit",
		loadComponent: () => import("./poll-form/poll-form").then((m) => m.PollForm),
		title: titled("editPoll"),
	},
	{ path: "**", redirectTo: "" },
];
