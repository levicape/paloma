import { Canary, PromiseActivity } from "@levicape/paloma";
import {
	LoggingContext,
	RuntimeContext,
} from "@levicape/paloma/runtime/server/RuntimeContext";
import { Effect } from "effect";
import { hc } from "hono/client";
import { HTTP_BASE_PATH, NevadaIoRoutemap } from "../http/Atlas.mjs";
import type { NevadaHonoApp } from "../http/HonoApp.mjs";

const client = hc<NevadaHonoApp>(NevadaIoRoutemap[HTTP_BASE_PATH].url());
const { trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			return {
				trace: (yield* logging.logger).withPrefix("canary").withContext({
					$event: "main",
				}),
			};
		}),
		RuntimeContext,
	),
);

export const healthcheck = new Canary(
	"http-healthcheck",
	{},
	new PromiseActivity(
		{
			events: {
				enter: async () => {
					const now = Date.now();
					trace
						.withMetadata({
							PromiseActivity: {
								now,
							},
						})
						.info("enter");
					return {
						now,
					};
				},
				exit: async ({ events }) => {
					trace
						.withMetadata({
							PromiseActivity: {
								now: events?.enter,
							},
						})
						.info("exit");
				},
			},
		},
		async ({ events }) => {
			trace.warn("Hello world");
			trace.metadataOnly([
				events,
				{ a: 1, b: "Y" },
				client["~"].Paloma.Nevada.ls.$url({}),
				{ a: "Z", b: 2 },
			]);
			const response = await client["~"].Paloma.Nevada.ls.$get({});
			const json = await response.json();
			trace.withMetadata({ json }).info("Fetched");
		},
	),
);

export const handler = healthcheck;
