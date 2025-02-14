import { Canary, PromiseActivity } from "@levicape/paloma";
import {
	LoggingContext,
	RuntimeContext,
} from "@levicape/paloma/runtime/server/RuntimeContext";
import { Effect } from "effect";

const { trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			return {
				trace: (yield* logging.logger).withPrefix("TESTFILE").withContext({
					event: "promiseactivity",
				}),
			};
		}),
		RuntimeContext,
	),
);

export const handler = new Canary(
	"promiseactivity_basic",
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
				{ a: 1, b: "Y" },
				{ a: "Z", b: 2 },
			]);
			trace.metadataOnly([
				{ a: 1, b: "Y" },
				{ a: "Z", b: 2 },
			]);
			trace.metadataOnly([
				{ a: 1, b: "Y" },
				{ a: "Z", b: 2 },
			]);
			trace.metadataOnly([
				{ a: 1, b: "Y" },
				{ a: "Z", b: 2 },
			]);
			trace
				.withMetadata({
					PromiseActivity: {
						now: events?.enter,
					},
				})
				.info("task");
		},
	),
);

// TODO: Implement global timeout, lambda executiontime thread
// export const fails25 = new Canary(
// 	"Fails25PromiseActivity",
// 	{},
// 	new PromiseActivity(
// 		{
// 			events: {
// 				enter: async () => {
// 					const now = Date.now();
// 					const seed = Math.random();
// 					const seed2 = Math.random();
// 					trace
// 						.withMetadata({
// 							PromiseActivity: {
// 								now,
// 							},
// 						})
// 						.info("enter");
// 					return {
// 						now,
// 					};
// 				},
// 				exit: async ({ events }) => {
// 					trace
// 						.withMetadata({
// 							PromiseActivity: {
// 								now: events.enter,
// 							},
// 						})
// 						.info("exit");
// 				},
// 			},
// 		},
// 		async ({ events }) => {
// 			const seed = Math.random();
// 			const seed2 = Math.random();
// 			trace
// 				.withMetadata({
// 					PromiseActivity: {
// 						events,
// 						seeds: [seed, seed2],
// 					},
// 				})
// 				.warn("There is a chance");

// 			if (seed <= 0.25) {
// 				trace.error("unlucky");

// 				throw new VError("Seed is less than 0.25");
// 			}

// 			trace.info("but it's okay");
// 		},
// 	),
// );
