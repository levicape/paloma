import { Canary, PromiseActivity } from "@levicape/paloma";
import {
	LoggingContext,
	RuntimeContext,
} from "@levicape/paloma/runtime/server/RuntimeContext";
import { Effect } from "effect";
import { hc } from "hono/client";
import type { NevadaHonoApp } from "../http/HonoApp.mjs";
import { NevadaIoRoutemap } from "./Atlas.mjs";

const client = hc<NevadaHonoApp>(NevadaIoRoutemap["/~/v1/Paloma/Nevada"].url());
const { Nevada } = client["~"].v1.Paloma;
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

trace
	.withMetadata({
		Nevada,
	})
	.info("Loaded service clients");

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
				Nevada.$url({}),
				{ a: "Z", b: 2 },
			]);
			const response = await Nevada.$get({});
			const json = await response.json();
			trace.withMetadata({ json }).info("Fetched");
		},
	),
);

export const handler = healthcheck;
