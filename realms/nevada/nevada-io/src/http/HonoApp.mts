import { HonoHttpServer } from "@levicape/spork/router/hono/HonoHttpServer";
import { HonoGuardAuthentication } from "@levicape/spork/router/hono/guard/security/HonoGuardAuthentication";
import type { HonoHttp } from "@levicape/spork/router/hono/middleware/HonoHttpMiddleware";
import type { HonoHttpAuthentication } from "@levicape/spork/router/hono/middleware/security/HonoAuthenticationBearer";
import { createFactory } from "hono/factory";
import { HTTP_BASE_PATH } from "./Polly.mjs";

export type HttpMiddleware = HonoHttp & HonoHttpAuthentication;

export const { server } = await HonoHttpServer(
	createFactory<HttpMiddleware>({
		initApp: () => {},
	}),
	(app) =>
		app
			.basePath(HTTP_BASE_PATH)

			.use(
				HonoGuardAuthentication(async ({ principal }) => {
					return principal.$case !== "anonymous";
				}),
			)
			.get("/ls", async (c) => {
				return c.json({
					data: {
						message: "Hello!",
					},
				});
			}),
);

export type NevadaHonoApp = typeof server.app;
