import {
	Chunk,
	Context,
	Duration,
	Effect,
	ExecutionStrategy,
	Fiber,
	Layer,
	Queue,
	Ref,
	Scope,
	SubscriptionRef,
	pipe,
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

export type ExecutionFiberQueueItem = {
	canary: Canary;
};

export class ExecutionFiber extends Context.Tag("ExecutionFiber")<
	ExecutionFiber,
	{ readonly queue: Queue.Queue<ExecutionFiberQueueItem> }
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
			const queue = yield* Queue.unbounded<ExecutionFiberQueueItem>();
			const fiber = yield* forkDaemon(
				Effect.gen(function* () {
					let fibertrace = trace.child().withContext({
						event: "execution-fiber-daemon",
					});
					fibertrace.debug("Created ExecutionFiber. Waiting for first Canary.");

					const first = yield* Queue.take(queue);
					fibertrace.debug("Received Canary. Waiting for HandlerSignal.");

					yield* Effect.fork(
						Effect.gen(function* () {
							const waittrace = fibertrace.child().withContext({
								event: "execution-fiber-wait",
							});
							waittrace
								.withMetadata({
									ExecutionFiber: { HANDLER_SIGNAL_SECONDS },
								})
								.debug("Waiting and releasing HandlerSignal.");
							yield* Effect.sleep(Duration.seconds(HANDLER_SIGNAL_SECONDS));
							yield* signals.handler.release;
							waittrace
								.withMetadata({
									signal: "ReadySignal",
									what: "release",
								})
								.debug("Released HandlerSignal.");
						}),
					);

					yield* signals.ready.open;
					fibertrace
						.withMetadata({
							signal: "ReadySignal",
							what: "open",
						})
						.debug("Opened ReadySignal. Waiting for HandlerSignal.");

					yield* signals.handler.await;
					fibertrace
						.withMetadata({
							signal: "HandlerSignal",
							what: "await",
						})
						.debug("Received HandlerSignal.");

					const canaries = [
						first,
						...Chunk.toReadonlyArray(yield* queue.takeAll),
					];
					fibertrace
						.withMetadata({
							ExecutionFiber: {
								canaries,
							},
						})
						.debug(
							"Received canaries. Creating loop fiber and waiting for ExitSignal.",
						);
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
							looptrace.debug("Created execution loop. Closing ReadySignal.");

							while (yield* Ref.get(running)) {
								yield* signals.ready.close;
								looptrace
									.withMetadata({
										signal: "ReadySignal",
										what: "close",
									})
									.debug(
										"Closed ReadySignal. Creating actors and retrieving ExecutionPlan.",
									);

								yield* pipe(
									Effect.gen(function* (scope) {
										yield* Effect.sleep(Duration.seconds(2));
									}),
								);
								looptrace.debug("Actors created. Handling ExecutionPlan.");

								yield* pipe(
									Effect.gen(function* (scope) {
										// ExecutionLog resource
										yield* Effect.sleep(Duration.seconds(2));
									}),
								);
								looptrace.debug("ExecutionPlans done. Releasing DoneSignal");

								yield* signals.done.release;
								looptrace
									.withMetadata({
										signal: "DoneSignal",
										what: "release",
									})
									.debug("Released DoneSignal. Forking timeout fiber.");
								const timeoutFiber = yield* Effect.fork(
									Effect.gen(function* () {
										const interrupttrace = looptrace.child().withContext({
											event: "execution-fiber-timeout",
										});
										interrupttrace
											.withMetadata({
												ExecutionFiber: { INTERRUPT_FIBER_SECONDS },
											})
											.debug(
												"Sleeping. Will terminate loop unless interrupted.",
											);
										yield* Effect.sleep(
											Duration.seconds(INTERRUPT_FIBER_SECONDS),
										);
										interrupttrace.debug(
											"Timeout fiber wake. Closing ReadySignal.",
										);
										yield* signals.ready.close;
										interrupttrace
											.withMetadata({
												signal: "ReadySignal",
												what: "close",
											})
											.debug(
												"Closed ReadySignal. Setting loop condition to false and opening HandlerSignal.",
											);
										yield* Ref.set(running, false);
										yield* signals.handler.open;
										interrupttrace
											.withMetadata({
												signal: "HandlerSignal",
												what: "open",
											})
											.debug(
												"Opened HandlerSignal. This will allow the loop to run and check it's loop condition.",
											);
									}),
								);

								if (yield* Ref.get(running)) {
									yield* signals.ready.open;
									looptrace
										.withMetadata({
											signal: "ReadySignal",
											what: "open",
										})
										.debug("Opened ReadySignal. Waiting for HandlerSignal.");

									yield* signals.handler.await;
									looptrace
										.withMetadata({
											signal: "HandlerSignal",
											what: "await",
										})
										.debug("Received HandlerSignal. Loop will continue.");

									yield* Fiber.interrupt(timeoutFiber);
									looptrace
										.withMetadata({
											fiber: "timeout",
											what: "interrupt",
										})
										.debug("Interrupted timeout fiber.");
								}
							}
							looptrace
								.withMetadata({
									ExecutionFiber: { EXIT_SIGNAL_SECONDS },
								})
								.debug(
									"Loop condition false. Sleeping and releasing exit signal.",
								);
							yield* Effect.sleep(Duration.seconds(EXIT_SIGNAL_SECONDS));
							yield* signals.exit.release;
							looptrace
								.withMetadata({
									signal: "ExitSignal",
									what: "release",
								})
								.debug("Released ExitSignal. Exiting fiber.");
						}),
					);
					yield* signals.exit.await;

					fibertrace
						.withMetadata({
							signal: "ExitSignal",
							what: "await",
						})
						.debug("Received exit signal.");
				}),
			);

			trace.debug("Initialized ExecutionFiber.");
			return {
				queue,
				fiber,
			} as const;
		}),
		InternalContext,
	),
);
