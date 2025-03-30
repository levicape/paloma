import assert from "node:assert";
import { Canary, PromiseActivity } from "@levicape/paloma";
import { NevadaIoRoutemap } from "@levicape/paloma-nevada-io/http/Atlas";
import { LoggingContext } from "@levicape/paloma/runtime/server/RuntimeContext";
import { withStructuredLogging } from "@levicape/paloma/runtime/server/loglayer/LoggingContext";
import { Context, Effect } from "effect";

// @ts-ignore
const { trace } = await Effect.runPromise(
	// @ts-ignore
	Effect.provide(
		// @ts-ignore
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			return {
				trace: (yield* logging.logger).withPrefix("canary").withContext({
					$event: "main",
				}),
			};
		}),
		// @ts-ignore
		Context.empty().pipe(withStructuredLogging({ prefix: "ExecutionPlan" })),
	),
);
trace
	?.withMetadata({
		NevadaIoRoutemap,
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
			trace.metadataOnly([events, NevadaIoRoutemap["/"].url()]);
			{
				const response = await fetch(NevadaIoRoutemap["/"].url());
				const json = await response.text();
				trace.withMetadata({ json }).info("Fetched");
				assert(response.ok, `Response not ok: ${response.status}`);
			}
		},
	),
);

export const handler = healthcheck;
