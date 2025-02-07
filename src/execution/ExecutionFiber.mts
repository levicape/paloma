import {
	Chunk,
	Context,
	Duration,
	Effect,
	Fiber,
	Layer,
	Queue,
	Ref,
	SubscriptionRef,
} from "effect";
import { forkDaemon, gen } from "effect/Effect";
import VError from "verror";
import type { Canary } from "../actor/Canary.mjs";
import { InternalContext } from "../server/ServerContext.mjs";
import { LoggingContext } from "../server/loglayer/LoggingContext.mjs";
import {
	DoneSignal,
	ExitSignal,
	HandlerSignal,
	ReadySignal,
} from "./ExecutionSignals.mjs";

const HANDLER_SIGNAL_SECONDS = 5;
const INTERRUPT_FIBER_SECONDS = 5;
const EXIT_SIGNAL_SECONDS = 5;

let { trace, signals } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			return {
				trace: (yield* logging.logger).withPrefix("execution").withContext({
					event: "execution-fiber-main",
				}),
				signals: {
					ready: yield* yield* ReadySignal,
					handler: yield* yield* HandlerSignal,
					exit: yield* yield* ExitSignal,
					done: yield* yield* DoneSignal,
				},
			};
		}),
		InternalContext,
	),
);

export type ExecutionStageRegistryItem = {
	canary: Canary;
};

export class ExecutionFiber extends Context.Tag("ExecutionStage")<
	ExecutionFiber,
	{ readonly queue: Queue.Queue<ExecutionStageRegistryItem> }
>() {}

/**
 * ExecutionFiberMain manages Canary execution through the lifecycle of the Paloma process.
 *
 * Some runtimes directly call a handler function, while regular NodeJS runtimes will instead just execute whatever is in the given module.
 * This fiber first will wait for the first Canaries to register themselves, then will wait for a HandlerSignal.
 * The latch is opened automatically after a certain amount of time, or if opened by a Canary handler.
 *
 * @HandlerSignal
 * @ReadySignal
 * @ExitSignal
 * @DoneSignal
 */
export const ExecutionFiberMain = Layer.effect(
	ExecutionFiber,
	Effect.provide(
		gen(function* () {
			const queue = yield* Queue.unbounded<ExecutionStageRegistryItem>();

			trace.debug("Initializing ExecutionStageRegistry.");
			const fiber = yield* forkDaemon(
				Effect.gen(function* () {
					let fibertrace = trace.child().withContext({
						event: "execution-fiber-daemon",
					});
					fibertrace.debug("Waiting for Canary.");

					const first = yield* Queue.take(queue);
					fibertrace.debug("Received Canary.");

					yield* Effect.fork(
						Effect.gen(function* () {
							fibertrace.debug(`Starting HandlerSignal release fiber.`);
							yield* Effect.sleep(Duration.seconds(HANDLER_SIGNAL_SECONDS));
							fibertrace
								.withMetadata({
									ExecutionStageRegistry: { HANDLER_SIGNAL_SECONDS },
								})
								.debug("Releasing HandlerSignal.");
							yield* signals.handler.release;
						}),
					);

					fibertrace.debug("Opening ReadySignal.");
					yield* signals.ready.open;

					fibertrace.debug("waiting for HandlerSignal.");
					yield* signals.handler.await;
					const canaries = [
						first,
						...Chunk.toReadonlyArray(yield* queue.takeAll),
					];

					fibertrace
						.withMetadata({
							ExecutionStageRegistry: {
								canaries,
							},
						})
						.debug("Received canaries.");
					if (
						new Set(canaries.map((c) => c.canary.name)).size !== canaries.length
					) {
						fibertrace.error(
							"Duplicate canary names detected. Canary names must be unique.",
						);
						throw new VError("Duplicate canary names detected.");
					}

					yield* forkDaemon(
						Effect.gen(function* () {
							let looptrace = fibertrace.child().withContext({
								event: "execution-fiber-loop",
							});
							let running = yield* SubscriptionRef.make(true);
							while (yield* Ref.get(running)) {
								looptrace.debug("Closing ReadySignal.");
								yield* signals.ready.close;
								looptrace.debug("Starting execution loop.");
								// biome-ignore lint:
								{
									// Run in generator
									yield* Effect.sleep(Duration.seconds(2));
									looptrace.debug("Converting canaries to actors.");
									yield* Effect.sleep(Duration.seconds(2));
									looptrace.debug("Handling actors.");
									// ExecutionLog resource
									yield* Effect.sleep(Duration.seconds(2));
								}
								looptrace.debug("Emitting done signal.");
								yield* signals.done.release;
								looptrace.debug("Forking interrupt fiber.");
								const interruptFiber = yield* Effect.fork(
									Effect.gen(function* () {
										looptrace
											.withMetadata({
												ExecutionStageRegistry: { INTERRUPT_FIBER_SECONDS },
											})
											.debug("Sleeping for INTERRUPT_FIBER.");
										yield* Effect.sleep(
											Duration.seconds(INTERRUPT_FIBER_SECONDS),
										);
										looptrace.debug(
											"Interrupt fiber wake. Closing ReadySignal.",
										);
										yield* signals.ready.close;
										looptrace.debug("Setting running to false.");
										yield* Ref.set(running, false);
										looptrace.debug("Opening HandlerSignal.");
										yield* signals.handler.open;
									}),
								);

								if (yield* Ref.get(running)) {
									looptrace.debug("Opening ReadySignal.");
									yield* signals.ready.open;
									looptrace.debug("Waiting for handler signal.");
									yield* signals.handler.await;
									looptrace.debug("Canceling interrupt fiber.");
									yield* Fiber.interrupt(interruptFiber);
									looptrace.debug("Cancelled interrupt fiber.");
								}
							}

							looptrace
								.withMetadata({
									ExecutionStageRegistry: { EXIT_SIGNAL_SECONDS },
								})
								.debug("Loop exited");
							yield* Effect.sleep(Duration.seconds(EXIT_SIGNAL_SECONDS));
							looptrace.debug("Releasing exit signal.");
							yield* signals.exit.release;
						}),
					);

					fibertrace.debug("Waiting for exit signal.");
					yield* signals.exit.await;
					fibertrace.debug("Received exit signal.");
				}),
			);
			trace.debug("Initialized ExecutionStageRegistry.");

			return {
				queue,
				fiber,
			} as const;
		}),
		InternalContext,
	),
);
