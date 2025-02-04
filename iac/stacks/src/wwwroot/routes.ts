import type { RoutePaths, RouteResource } from "../RouteMap";

export class PalomaNevadaRoutes {
	static readonly PUBLIC = ["/~/v1/Paloma/Nevada"] as const;
	static readonly ADMIN = ["/!/v1/Paloma/Nevada"] as const;
}

export class WWWRootRoutes {
	static readonly PUBLIC_ROUTES = [...PalomaNevadaRoutes.PUBLIC] as const;
	static readonly ADMIN_ROUTES = [...PalomaNevadaRoutes.ADMIN] as const;
}

export type WWWRootRoute = (typeof WWWRootRoutes.PUBLIC_ROUTES)[number];
export type WWWRootRouteMap<Resource extends RouteResource> = RoutePaths<
	WWWRootRoute,
	Resource
>;
