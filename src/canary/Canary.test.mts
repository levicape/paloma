import { Effect } from "effect";

import { RuntimeContext } from "../server/RuntimeContext.mjs";
import { LoggingContext } from "../server/loglayer/LoggingContext.mjs";
import { Canary } from "./Canary.mjs";
import { PromiseActivity } from "./activity/PromiseActivity.mjs";

const { trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			return {
				trace: (yield* logging.logger).withPrefix("TESTFILE").withContext({
					event: "canary-test",
				}),
			};
		}),
		RuntimeContext,
	),
);

export const canary = new Canary(
	"canary",
	{
		name: "canary",
	},
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
								now: events.enter,
							},
						})
						.info("exit");
				},
			},
		},
		async ({ events }) => {
			console.warn("");
			console.table([
				{ a: 1, b: "Y" },
				{ a: "Z", b: 2 },
			]);
			console.table([
				{ a: 1, b: "Y" },
				{ a: "Z", b: 2 },
			]);
			console.table([
				{ a: 1, b: "Y" },
				{ a: "Z", b: 2 },
			]);
			console.table([
				{ a: 1, b: "Y" },
				{ a: "Z", b: 2 },
			]);
			trace
				.withMetadata({
					PromiseActivity: {
						now: events.enter,
					},
				})
				.info("task");
		},
	),
);

if (Math.random() > 0.49) {
	setImmediate(() => {
		canary();
	});
}

// export const stateful = new Canary(
// 	"Stateful",
// 	{
// 		name: "stateful",
// 	},
// 	new StatefulActivity(
// 		{
// 			on: {
// 				prepare() {
// 					const now = Date.now();
// 					trace
// 						.withMetadata({
// 							StatefulActivity: {
// 								now,
// 							},
// 						})
// 						.info("prepare");
// 					return {
// 						now,
// 					};
// 				},
// 				async enter({ events }) {
// 					trace
// 						.withMetadata({
// 							StatefulActivity: {
// 								events,
// 							},
// 						})
// 						.info("enter");

// 					return {
// 						now: Date.now(),
// 					};
// 				},
// 				exit({ events }) {
// 					trace
// 						.withMetadata({
// 							StatefulActivity: {
// 								events,
// 							},
// 						})
// 						.info("exit");
// 				},
// 				stop({ events }) {
// 					trace
// 						.withMetadata({
// 							StatefulActivity: {
// 								events,
// 							},
// 						})
// 						.info("stop");

// 					return {
// 						now: Date.now(),
// 					};
// 				},
// 				teardown({ events }) {
// 					trace
// 						.withMetadata({
// 							StatefulActivity: {
// 								events,
// 							},
// 						})
// 						.info("teardown");
// 				},
// 			},
// 		},
// 		async ({ events }) => {
// 			trace
// 				.withMetadata({
// 					StatefulActivity: {
// 						events,
// 					},
// 				})
// 				.info("task");
// 		},
// 	),
// );
