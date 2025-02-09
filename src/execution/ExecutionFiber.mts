import { NodeRuntime } from "@effect/platform-node";
import {
	Chunk,
	Context,
	Duration,
	Effect,
	Exit,
	Fiber,
	Layer,
	Option,
	Queue,
	Ref,
	Scope,
	SubscriptionRef,
	pipe,
} from "effect";
import { forkDaemon, gen } from "effect/Effect";
import { deserializeError } from "serialize-error";
import VError from "verror";
import type { Canary } from "../canary/Canary.mjs";
import {
	ResourceLog,
	ResourceLogFile,
} from "../repository/resourcelog/ResourceLog.mjs";
import { InternalContext } from "../server/ServerContext.mjs";
import { withWriteStream } from "../server/fs/WriteStream.mjs";
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

// Config class, PALOMA_DATA_PATH
export const WorkQueueFilesystem = {
	root: "/tmp/paloma",
};

let { rootId, trace, signals } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			const trace = (yield* logging.logger)
				.withPrefix("execution")
				.withContext({
					$event: "execution-fiber-main",
				});
			const { rootId } = trace.getContext();

			return {
				rootId,
				signals: {
					ready: yield* yield* ReadySignal,
					handler: yield* yield* HandlerSignal,
					exit: yield* yield* ExitSignal,
					done: yield* yield* DoneSignal,
				},
				trace,
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
	Effect.scoped(
		Effect.provide(
			gen(function* () {
				trace.debug("Initializing ExecutionFiber.");
				const queue = yield* Queue.unbounded<ExecutionFiberQueueItem>();
				NodeRuntime.runMain(
					Effect.gen(function* () {
						let fibertrace = trace.child();

						fibertrace
							.withContext({
								$event: "execution-fiber-daemon",
							})
							.debug("Created ExecutionFiber. Waiting for first Canary.");

						const first = yield* Queue.take(queue);
						fibertrace
							.withMetadata({
								ExecutionFiber: {
									canary: first,
								},
							})
							.debug("Received Canary. Waiting for HandlerSignal.");

						const waitForCanariesFiber = yield* Effect.fork(
							Effect.gen(function* () {
								const waittrace = fibertrace.child();

								waittrace
									.withContext({
										$event: "execution-fiber-wait",
									})
									.withMetadata({
										ExecutionFiber: {
											waitForCanaries: HANDLER_SIGNAL_SECONDS,
										},
									})
									.debug(
										`WaitForCanariesFiber thread. Will sleep and release HandlerSignal.`,
									);

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

						yield* Fiber.interruptFork(waitForCanariesFiber);
						fibertrace
							.withMetadata({
								fiber: "WaitForCanariesFiber",
								what: "interrupt",
							})
							.debug("Interrupted WaitForCanariesFiber.");

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

						[duplicates, nameisfilesafe].reduce((acc, fn) => {
							const error = fn(canaries);
							if (error) {
								fibertrace
									.withMetadata({
										ExecutionFiber: {
											canaries,
										},
									})
									.error(
										"Duplicate canary names detected. Canary names must be unique.",
									);

								throw new VError(error);
							}

							return acc;
						}, undefined);

						const resourcelogScope = yield* Scope.make();
						yield* forkDaemon(
							Effect.scoped(
								Effect.gen(function* () {
									const looptrace = fibertrace.child();
									const resourcelog = yield* ResourceLog;

									let running = yield* SubscriptionRef.make(true);
									looptrace
										.withContext({
											$event: "execution-fiber-loop",
										})
										.debug("Created execution loop. Closing ReadySignal.");

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

										const actors = yield* Effect.all(
											canaries.map((c) =>
												Effect.scoped(
													Effect.gen(function* (_scope) {
														const actortrace = looptrace.child();
														actortrace
															.withContext({
																$event: "execution-fiber-actor",
																$Canary: {
																	name: c.canary.name,
																},
															})
															.debug("Yielding Actor instance from Canary.");

														yield* resourcelog.capture(
															actortrace.getContext.bind(actortrace),
														);
														const actor = yield* yield* Effect.try({
															try() {
																return c.canary.actor();
															},
															catch(error) {
																looptrace
																	.withError(deserializeError(error))
																	.error("Unable to create actor");
																return Option.none();
															},
														});
														actortrace
															.withMetadata({
																ExecutionFiber: {
																	actor,
																},
															})
															.debug("Actor created.");
														yield* Effect.sleep(
															Duration.seconds(Math.random()),
														);

														return Option.some({
															actor,
														});
													}),
												).pipe(
													Effect.catchAll((error) => {
														looptrace
															.withError(deserializeError(error))
															.error("Actor creation failed");
														return Option.none();
													}),
												),
											),
											{
												concurrency: "unbounded",
											},
										);
										looptrace
											.withMetadata({
												ExecutionFiber: {
													actors,
												},
											})
											.debug("Actors created. Handling ExecutionPlan.");

										yield* pipe(
											Effect.gen(function* (scope) {
												// ExecutionLog resource
												yield* Effect.sleep(Duration.seconds(2));
											}),
										);
										looptrace
											.withMetadata({})
											.debug("ExecutionPlans done. Releasing DoneSignal");

										yield* signals.done.release;
										looptrace
											.withMetadata({
												signal: "DoneSignal",
												what: "release",
											})
											.debug("Released DoneSignal. Forking timeout fiber.");

										const timeoutFiber = yield* Effect.fork(
											Effect.gen(function* () {
												const interrupttrace = looptrace.child();
												interrupttrace
													.withContext({
														$event: "execution-fiber-timeout",
													})
													.debug(
														`Sleeping for ${INTERRUPT_FIBER_SECONDS}s. Will terminate loop unless interrupted.`,
													);

												yield* Effect.sleep(
													Duration.seconds(INTERRUPT_FIBER_SECONDS),
												);
												interrupttrace
													.withMetadata({})
													.debug("Timeout fiber wake. Closing ReadySignal.");

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
												.debug(
													"Opened ReadySignal. Waiting for HandlerSignal.",
												);

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
							).pipe(
								Effect.provide(ResourceLogFile(resourcelogScope)),
								Effect.provide(
									Context.empty().pipe(
										withWriteStream({
											name: `${WorkQueueFilesystem.root}/!execution/-resourcelog/${rootId}.rlog.csv`,
											scope: resourcelogScope,
										}),
									),
								),
							),
						);
						yield* signals.exit.await;
						fibertrace
							.withMetadata({
								signal: "ExitSignal",
								what: "await",
							})
							.debug("Received exit signal.");

						yield* Scope.close(resourcelogScope, Exit.succeed(undefined));
						fibertrace
							.withMetadata({
								scope: "ResourceLogScope",
								what: "close",
							})
							.debug("Closed ResourceLogScope.");
					}),
				);

				return {
					queue,
				} as const;
			}),
			Context.mergeAll(InternalContext),
		),
	),
);
// Todo: Use Schema/Zod
const duplicates = (canaries: Array<ExecutionFiberQueueItem>) => {
	if (new Set(canaries.map((c) => c.canary.name)).size !== canaries.length) {
		return "Duplicate canary names detected.";
	}
	return;
};

const nameisfilesafe = (canaries: Array<ExecutionFiberQueueItem>) => {
	if (canaries.some((c) => c.canary.name.match(/[^a-zA-Z0-9]/))) {
		return "Canary name is not file safe.";
	}
	return;
};
