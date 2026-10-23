import { inject } from "@angular/core";
import { Router, type Routes } from "@angular/router";
import { Auth } from "./auth";

const signedIn = () => inject(Auth).signedIn() || inject(Router).createUrlTree(["/"]);

export const routes: Routes = [
	{ path: "", loadComponent: () => import("./home/home").then((m) => m.Home) },
	{
		path: ":owner/:repo",
		canActivate: [signedIn],
		loadComponent: () => import("./timeline/timeline").then((m) => m.Timeline),
	},
	{
		path: ":owner/:repo/workflows",
		canActivate: [signedIn],
		loadComponent: () => import("./workflows/workflows-page").then((m) => m.WorkflowsPage),
	},
	{ path: "**", redirectTo: "" },
];
