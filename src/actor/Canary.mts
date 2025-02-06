import { Effect } from "effect";
import { gen } from "effect/Effect";
import type { Activity } from "../activity/Activity.mjs";
import { DoneSignal, HandlerSignal } from "../execution/ExecutionSignals.mjs";
import {
	ExecutionStage,
	ExecutionStageRegistry,
} from "../execution/ExecutionStage.mjs";
import { InternalContext } from "../server/ServerContext.mjs";
import { LoggingContext } from "../server/loglayer/LoggingContext.mjs";
import { Actor } from "./Actor.mjs";

const {
	logging: { trace },
	signals: { handler, done },
	registry,
} = await Effect.runPromise(
	Effect.provide(
		Effect.provide(
			Effect.gen(function* () {
				const registry = yield* ExecutionStage;
				const logging = yield* LoggingContext;

				const handler = yield* yield* HandlerSignal;
				const done = yield* yield* DoneSignal;

				return {
					logging: {
						trace: (yield* logging.logger).withPrefix("canary").withContext({
							event: "canary",
						}),
					},
					registry,
					signals: {
						handler,
						done,
					},
				};
			}),
			InternalContext,
		),
		ExecutionStageRegistry,
	),
);

export type CanaryProps = {};

// Config class, PALOMA_DATA_PATH
const WorkQueueFilesystem = {
	root: "/tmp/paloma",
};

/**
 * Canary classes define an Activity that the Paloma runtime will run on each execution.
 */
export class Canary {
	constructor(
		/**
		 * Unique name for this canary
		 */
		public readonly name: string,
		public readonly props: CanaryProps,
		/**
		 * Activity to run on each execution
		 */
		public readonly activity: Activity,
	) {
		const canary = this;
		trace
			.withContext({
				Canary: {
					...props,
					activity: activity.constructor.name,
				},
			})
			.debug("Canary created");

		Effect.runFork(
			Effect.gen(function* () {
				yield* registry.queue.offer({
					canary,
				});

				trace
					.withMetadata({
						Canary: {
							registry,
						},
					})
					.debug("Registered Canary with queue");
			}),
		);
	}

	async actor() {
		const canary = this;
		const hash = await this.activity.hash();
		const path = `${WorkQueueFilesystem.root}/actor/${this.name}_${hash}.sqlite`;
		trace
			.withContext({
				Canary: {
					data: {
						actor: path,
					},
				},
			})
			.debug("Creating actor");
		const actor = gen(function* () {
			yield* Effect.sleep(1);
			return new Actor({
				canary,
			});
		});

		return actor;
	}

	handler = async (_event: unknown, _context: unknown) => {
		trace
			.withContext({
				Canary: {
					event: _event,
					context: _context,
				},
			})
			.debug("Canary handler");
		await Effect.runPromise(
			Effect.gen(function* () {
				trace.debug("handler: Releasing HandlerSignal");
				yield* handler.release;
				trace.debug("handler: Awaiting DoneSignal");
				yield* done.await;
			}),
		);
	};
}
