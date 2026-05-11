import { Routes } from "@angular/router";

export const routes: Routes = [
	{
		path: "",
		loadComponent: () => import("./pages/home/home.component").then((m) => m.HomeComponent),
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
