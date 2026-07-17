import { Routes } from "@angular/router";

export const routes: Routes = [
	{
		path: "",
		loadComponent: () => import("./pages/landing/landing.component").then((m) => m.LandingComponent),
	},
	{
		path: "login",
		loadComponent: () => import("./pages/home/home.component").then((m) => m.HomeComponent),
	},
	{
		path: "sessions",
		loadComponent: () =>
			import("./pages/sessions/sessions.component").then((m) => m.SessionsComponent),
	},
	{
		path: "play/:roomId",
		loadComponent: () =>
			import("./pages/play-room/play-room.component").then((m) => m.PlayRoomComponent),
	},
	{
		path: "**",
		redirectTo: "",
	},
];
