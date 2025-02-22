import type { RoutePaths, RouteResource } from "../../../RouteMap";

export class PalomaNevadaRoutes {
	static readonly PUBLIC = ["/~/v1/Paloma/Nevada"] as const;
	static readonly ADMIN = ["/!/v1/Paloma/Nevada"] as const;
}

export class PalomaNevadaWWWRootRoutes {
	static readonly PUBLIC_ROUTES = [...PalomaNevadaRoutes.PUBLIC] as const;
	static readonly ADMIN_ROUTES = [...PalomaNevadaRoutes.ADMIN] as const;
}

export type PalomaNevadaWWWRootRoute =
	(typeof PalomaNevadaWWWRootRoutes.PUBLIC_ROUTES)[number];
export type PalomaNevadaWWWRootRouteMap<Resource extends RouteResource> =
	RoutePaths<PalomaNevadaWWWRootRoute, Resource>;
