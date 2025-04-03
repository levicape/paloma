import { SporkHonoHttpServer } from "@levicape/spork/router/hono/HonoHttpServerBuilder";
import { HonoGuardAuthentication } from "@levicape/spork/router/hono/guard/security/HonoGuardAuthentication";
import { HTTP_BASE_PATH } from "./Atlas.mjs";

export const { server, handler, stream } = await SporkHonoHttpServer((app) =>
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
