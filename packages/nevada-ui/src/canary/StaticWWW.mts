import assert from "node:assert";
import { Canary, PromiseActivity } from "@levicape/paloma";
import {
	LoggingContext,
	RuntimeContext,
} from "@levicape/paloma/runtime/server/RuntimeContext";
import { Effect } from "effect";
import { NevadaUiRoutemap } from "./Atlas.mjs";

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
		NevadaUiRoutemap,
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
			trace.metadataOnly([events, NevadaUiRoutemap["/"].url()]);
			{
				const response = await fetch(NevadaUiRoutemap["/"].url());
				const json = await response.text();
				trace.withMetadata({ json }).info("Fetched");
				assert(response.ok, `Response not ok: ${response.status}`);
			}
		},
	),
);

export const handler = healthcheck;
