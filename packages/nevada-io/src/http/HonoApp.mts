import { SporkHonoHttpServer } from "@levicape/spork/hono";
import { Hono } from "hono";

export const { server, handler } = await SporkHonoHttpServer((app) =>
	app.basePath("/~/v1/Paloma/Nevada").get("/", async (c) => {
		return c.json({ message: `Hello, ${Hono.name}!` });
	}),
);

export type NevadaHonoApp = typeof server.app;
