import { Effect } from "effect";

import { PromiseActivity } from "../activity/PromiseActivity.mjs";
import { StatefulActivity } from "../activity/StatefulActivity.mjs";
import { InternalContext } from "../server/ServerContext.mjs";
import { LoggingContext } from "../server/loglayer/LoggingContext.mjs";
import { Canary } from "./Canary.mjs";

const { trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			return {
				trace: (yield* logging.logger).withContext({
					event: "canary-test",
				}),
			};
		}),
		InternalContext,
	),
);

export const canary = new Canary(
	"Canary",
	{
		name: "canary",
	},
	new PromiseActivity(
		{
			on: {
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

setTimeout(() => {
	canary();
}, 1200);

export const stateful = new Canary(
	"Stateful",
	{
		name: "stateful",
	},
	new StatefulActivity(
		{
			on: {
				prepare() {
					const now = Date.now();
					trace
						.withMetadata({
							StatefulActivity: {
								now,
							},
						})
						.info("prepare");
					return {
						now,
					};
				},
				async enter({ events }) {
					trace
						.withMetadata({
							StatefulActivity: {
								events,
							},
						})
						.info("enter");

					return {
						now: Date.now(),
					};
				},
				exit({ events }) {
					trace
						.withMetadata({
							StatefulActivity: {
								events,
							},
						})
						.info("exit");
				},
				stop({ events }) {
					trace
						.withMetadata({
							StatefulActivity: {
								events,
							},
						})
						.info("stop");

					return {
						now: Date.now(),
					};
				},
				teardown({ events }) {
					trace
						.withMetadata({
							StatefulActivity: {
								events,
							},
						})
						.info("teardown");
				},
			},
		},
		async ({ events }) => {
			trace
				.withMetadata({
					StatefulActivity: {
						events,
					},
				})
				.info("task");
		},
	),
);
