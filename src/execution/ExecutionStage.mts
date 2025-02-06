import { Chunk, Context, Duration, Effect, Layer, Queue } from "effect";
import { gen, runFork } from "effect/Effect";
import type { Canary } from "../actor/Canary.mjs";
import { InternalContext } from "../server/ServerContext.mjs";
import { LoggingContext } from "../server/loglayer/LoggingContext.mjs";
import { HandlerSignal } from "./ExecutionSignals.mjs";

const WAIT_FOR_SECONDS = 5;

const {
	trace,
	signals: { handler },
} = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const handler = yield* yield* HandlerSignal;
			const logging = yield* LoggingContext;
			return {
				trace: (yield* logging.logger).withPrefix("stage").withContext({
					event: "execution-stage",
				}),
				signals: {
					handler,
				},
			};
		}),
		InternalContext,
	),
);

export type ExecutionStageRegistryItem = {
	canary: Canary;
};

export class ExecutionStage extends Context.Tag("ExecutionStage")<
	ExecutionStage,
	{ readonly queue: Queue.Queue<ExecutionStageRegistryItem> }
>() {}

/**
 * ExeuctionStageRegistry waits for Canaries to be initialized before continuing execution
 */
export const ExecutionStageRegistry = Layer.effect(
	ExecutionStage,
	gen(function* () {
		const queue = yield* Queue.unbounded<ExecutionStageRegistryItem>();

		trace.debug("Initialized ExecutionStageRegistry");

		const loop = Effect.gen(function* () {
			trace.debug("Waiting for Canary");
			const first = yield* Queue.take(queue);
			trace.debug("Received Canary");

			runFork(
				Effect.provide(
					Effect.gen(function* () {
						trace.debug(`Starting HandlerSignal release fiber`);
						yield* Effect.sleep(Duration.seconds(WAIT_FOR_SECONDS));
						trace
							.withMetadata({ ExecutionStageRegistry: { WAIT_FOR_SECONDS } })
							.debug("Releasing HandlerSignal");
						yield* handler.release;
					}),
					InternalContext,
				),
			);

			trace.debug("waiting for HandlerSignal.");
			yield* handler.await;
			trace.debug("received HandlerSignal.");
			const rest = yield* queue.takeAll;

			trace
				.withMetadata({
					ExecutionStageRegistry: {
						canaries: [first, ...Chunk.toReadonlyArray(rest)],
					},
				})
				.debug("Received canaries.");

			/*
				create interrupt

				while true {
					sync effect
						convert canaries to actors
						handle actors
					emit done					
					fork effect
						-> sleep 3, signal interrupt
					wait for handler				
				}

				await interrupt

				*/
		});

		runFork(loop);

		return {
			queue,
		} as const;
	}),
);
