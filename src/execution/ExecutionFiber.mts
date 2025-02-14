import { inspect } from "node:util";
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
} from "effect";
import { forkDaemon, gen } from "effect/Effect";
import { deserializeError } from "serialize-error";
import VError from "verror";
import type { Actor } from "../actor/Actor.mjs";
import type {
	Canary,
	CanaryActorDependencies,
	CanaryActorProps,
	CanaryIdentifiers,
} from "../canary/Canary.mjs";
import { PalomaRepositoryConfig } from "../repository/RepositoryConfig.mjs";
import {
	ResourceLog,
	ResourceLogFile,
} from "../repository/resourcelog/ResourceLog.mjs";
import { RuntimeContext } from "../server/RuntimeContext.mjs";
import { withWriteStream } from "../server/fs/WriteStream.mjs";
import { LoggingContext } from "../server/loglayer/LoggingContext.mjs";
import { $$_traceId_$$ } from "../server/loglayer/LoggingPlugins.mjs";
import {
	DoneSignal,
	ExitSignal,
	HandlerSignal,
	ReadySignal,
} from "./ExecutionSignals.mjs";

const HANDLER_SIGNAL_SECONDS = 0.6 + Math.random() * 190 * 0.01; // 0.6 - 1.5
const INTERRUPT_FIBER_SECONDS = 0.05;
const EXIT_SIGNAL_SECONDS = 0.05;

let { rootId, config, trace, signals } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const config = yield* PalomaRepositoryConfig;
			const logging = yield* LoggingContext;
			const trace = (yield* logging.logger)
				.withPrefix("execution")
				.withContext({
					$event: "execution-fiber-main",
				});
			const { rootId } = trace.getContext();

			return {
				rootId,
				config,
				signals: {
					ready: yield* yield* ReadySignal,
					handler: yield* yield* HandlerSignal,
					exit: yield* yield* ExitSignal,
					done: yield* yield* DoneSignal,
				},
				trace,
			};
		}),
		RuntimeContext,
	),
);

export const ExecutionFiberResourceLogPath = () =>
	`${config.data_path}/!execution/-fiber/context`;

export type ExecutionFiberQueueItem = {
	identifiers: CanaryIdentifiers;
	actor: (
		props: CanaryActorProps,
	) => Effect.Effect<Actor<Canary>, unknown, CanaryActorDependencies>;
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
				trace
					.withContext({
						$ExecutionFiberMain: {
							started: new Date().toISOString(),
						},
					})
					.debug("Initializing ExecutionFiber.");

				const queue = yield* Queue.unbounded<ExecutionFiberQueueItem>();
				NodeRuntime.runMain(
					Effect.gen(function* () {
						let fibertrace = trace.child();
						// Check lambda handler context for timeout
						fibertrace
							.withContext({
								$event: "execution-fiber-daemon",
							})
							.debug(
								"Created ExecutionFiber. Waiting for first Actor to be registered.",
							);

						const first = yield* Queue.take(queue);
						fibertrace.debug(
							"Received Actor. Will fork WaitForActorsFiber and then open ReadySignal",
						);

						const waitForHandlerSignalFiber = yield* Effect.fork(
							Effect.gen(function* () {
								const waittrace = fibertrace.child();

								waittrace
									.withContext({
										$event: "execution-fiber-wait",
										$signal: "HandlerSignal",
									})
									.withMetadata({
										ExecutionFiber: {
											waitForCanaries: HANDLER_SIGNAL_SECONDS,
										},
									})
									.debug(
										`WaitForHandler thread. Will sleep and release HandlerSignal.`,
									);

								yield* Effect.sleep(Duration.seconds(HANDLER_SIGNAL_SECONDS));
								yield* signals.handler.release;
								waittrace
									.withMetadata({
										signal: "HandlerSignal",
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

						yield* Fiber.interruptFork(waitForHandlerSignalFiber);
						fibertrace
							.withMetadata({
								fiber: "WaitForCanariesFiber",
								what: "interrupt",
							})
							.debug("Interrupted WaitForCanariesFiber.");

						const actors = [
							first,
							...Chunk.toReadonlyArray(yield* queue.takeAll),
						];
						fibertrace
							.withMetadata({
								ExecutionFiber: {
									actors: actors.map(({ identifiers }) => {
										return { name: identifiers.name, hash: identifiers.hash };
									}),
								},
							})
							.debug(
								"Received Actor effects. Creating loop fiber and waiting for ExitSignal.",
							);

						[duplicates, nameisfilesafe].reduce((acc, fn) => {
							const error = fn(actors);
							if (error) {
								fibertrace
									.withMetadata({
										ExecutionFiber: {
											canaries: actors.map(({ identifiers }) => {
												return {
													name: identifiers.name,
													hash: identifiers.hash,
												};
											}),
										},
									})
									.error(error);

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
												"Closed ReadySignal. Creating actors and retrieving ExecutionPlan instances.",
											);

										const actorInstances = yield* Effect.all(
											actors.map((queueItem) =>
												Effect.scoped(
													Effect.gen(function* (_scope) {
														const actortrace = looptrace.child();
														actortrace
															.withContext({
																$event: "execution-fiber-actor",
																$Canary: {
																	name: queueItem.identifiers,
																},
															})
															.debug("Yielding Actor instance.");

														yield* resourcelog.capture(
															"ExecutionFiber-actor",
															actortrace.getContext.bind(actortrace),
														);
														const actor = yield* yield* Effect.try({
															try() {
																return queueItem
																	.actor({
																		contextlog: resourcelog,
																	})
																	.pipe(Scope.extend(resourcelogScope));
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
																	actor: actor.identifiers,
																},
															})
															.debug("Actor created.");

														return Option.some({
															actor,
															identifiers: queueItem.identifiers,
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
													actorInstances,
												},
											})
											.debug(
												"Actors created. Creating ExecutionPlans and iterating.",
											);

										const executions = yield* Effect.all(
											actorInstances.flatMap((actorOption) =>
												Effect.scoped(
													Effect.gen(function* (_scope) {
														const actor = yield* actorOption;
														const executiontrace = looptrace.child();
														executiontrace
															.withContext({
																$event: "execution-fiber-plan",
																$Actor: {
																	id: actor.identifiers,
																},
															})
															.debug("Yielding ExecutionPlan instance.");

														yield* resourcelog.capture(
															"ExecutionFiber-actor",
															executiontrace.getContext.bind(executiontrace),
														);

														const contextprops = {
															contextlog: resourcelog,
														};
														const actorplan = actor.actor.plan();
														const { plan } = yield* actorplan(contextprops);

														executiontrace
															.withContext({
																$ExecutionFiberPlan: {
																	actor: actor.identifiers,
																},
															})
															.debug("ExecutionPlan created.");

														const plantask = plan.task(contextprops);
														let taskoption: Effect.Effect.Success<
															ReturnType<typeof plantask>
														>;
														executiontrace
															.withContext({
																$event: "execution-fiber-task",
															})
															.debug("Starting ExecutionPlan loop.");

														while ((taskoption = yield* plantask())) {
															if (Option.isNone(taskoption)) {
																break;
															}
															const { task } = yield* taskoption;
															const traceId = $$_traceId_$$();
															executiontrace
																.withContext({
																	traceId,
																})
																.withMetadata({
																	ExecutionFiberPlan: {
																		task: task.activity,
																	},
																})
																.debug("ExecutionPlan yielded task.");

															try {
																yield* Effect.promise(() => task.delta());
															} catch (e: unknown) {
																const message =
																	"Could not execute Task delta()";
																executiontrace
																	.withMetadata({
																		ExecutionFiberLoop: {
																			actor,
																			plan,
																			task,
																		},
																	})
																	.withError(deserializeError(e))
																	.error(message);

																yield* signals.exit.open;

																throw new VError(deserializeError(e), message);
															}

															executiontrace.debug(
																"ExecutionPlan task delta completed.",
															);

															yield* Effect.sleep(
																Duration.seconds(INTERRUPT_FIBER_SECONDS),
															);
														}

														return Option.some({
															actor,
															plan,
														});
													}),
												).pipe(
													Effect.catchAll((error) => {
														looptrace
															.withError(deserializeError(error))
															.error("ExecutionPlan failed");
														return Option.none();
													}),
												),
											),
											{
												concurrency: "unbounded",
											},
										);
										looptrace
											.withMetadata({})
											.debug("ExecutionPlan done. Forking Timeout fiber");
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
											name: ExecutionFiberResourceLogPath(),
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

						// Result + Totals (Canaries -> Activity runs) (internally Actor -> ExecutionPlan runs)
						// ExecutionPlan Result effect
					}).pipe(
						Effect.andThen(
							Effect.gen(function* () {
								trace
									.withMetadata({
										ExecutionFiberMain: {
											ended: new Date().toISOString(),
										},
									})
									.debug("ExecutionFiber done. Releasing DoneSignal");

								yield* signals.done.release;

								trace
									.withMetadata({
										signal: "DoneSignal",
										what: "release",
									})
									.debug("Released DoneSignal.");
							}),
						),
					),
				);

				return {
					queue,
				} as const;
			}),
			Context.mergeAll(RuntimeContext),
		),
	),
);
// Todo: Use Schema/Zod
const duplicates = (actors: Array<ExecutionFiberQueueItem>) => {
	if (new Set(actors.map((c) => c.identifiers.name)).size !== actors.length) {
		return "Duplicate canary names detected.";
	}
	return;
};

const nameisfilesafe = (actors: Array<ExecutionFiberQueueItem>) => {
	const unsafe = actors
		.filter((c) => c.identifiers.name.match(/[^a-zA-Z0-9-_]/))
		.map((c) => inspect(c.identifiers.name, { depth: null }));

	if (unsafe.length > 0) {
		const yies = unsafe.length > 1 ? "ies" : "y";
		const isare = unsafe.length > 1 ? "are" : "is";
		return `Canar${yies} (${unsafe.join(", ")}) ${isare} not file safe. Only a-z, A-Z, 0-9, '-', '_' are allowed.`;
	}

	return;
};
