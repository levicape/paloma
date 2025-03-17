import { SporkHonoHttpServer } from "@levicape/spork/router/hono/HonoHttpServerBuilder";

import { Hono } from "hono";
import { HTTP_BASE_PATH } from "./Atlas.mjs";

export const { server, handler } = await SporkHonoHttpServer((app) =>
	app.basePath(HTTP_BASE_PATH).get("/", async (c) => {
		return c.json({ message: `Hello, ${Hono.name}!` });
	}),
);

export type NevadaHonoApp = typeof server.app;
