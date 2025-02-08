import { Context, Effect, Option, pipe } from "effect";
import { gen, makeSemaphore } from "effect/Effect";
import type { ILogLayer } from "loglayer";
import { ulid } from "ulidx";
import VError from "verror";
import type { Activity } from "../activity/Activity.mjs";
import {
	ExecutionFiber,
	ExecutionFiberMain,
} from "../execution/ExecutionFiber.mjs";
import {
	DoneSignal,
	ExitSignal,
	HandlerSignal,
	ReadySignal,
} from "../execution/ExecutionSignals.mjs";
import { InternalContext } from "../server/ServerContext.mjs";
import { withDb0 } from "../server/db0/DatabaseContext.mjs";
import { LoggingContext } from "../server/loglayer/LoggingContext.mjs";
import { Actor } from "./Actor.mjs";

const {
	logging: { trace },
	signals: { handler, done, ready, mutex },
	registry,
	// resourcelog,
} = await Effect.runPromise(
	Effect.provide(
		Effect.provide(
			Effect.gen(function* () {
				const registry = yield* ExecutionFiber;
				const logging = yield* LoggingContext;
				// const resourcelog = yield* ResourcelogContext;
				return {
					logging: {
						trace: (yield* logging.logger).withPrefix("canary").withContext({
							event: "canary",
						}),
					},
					signals: {
						ready: yield* yield* ReadySignal,
						handler: yield* yield* HandlerSignal,
						exit: yield* yield* ExitSignal,
						done: yield* yield* DoneSignal,
						mutex: yield* makeSemaphore(1),
					},
					// resourcelog
					registry,
				};
			}),
			InternalContext,
		),
		ExecutionFiberMain,
	),
);

// const log = `${WorkQueueFilesystem.root}/canary/resource.log`;

export type CanaryProps = {};

// Config class, PALOMA_DATA_PATH
const WorkQueueFilesystem = {
	root: "/tmp/paloma",
};

/**
 * Canary classes define an Activity that the Paloma runtime will run on each execution.
 */
export class Canary extends Function {
	private trace: ILogLayer;
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
		super();

		const canary = this;
		const canarytrace = trace.child().withContext({
			event: "canary-activity",
			action: "constructor()",
			$Canary: {
				name,
			},
		});
		this.trace = canarytrace;
		canarytrace.debug("Canary created");

		Effect.runFork(
			Effect.gen(function* () {
				yield* registry.queue.offer({
					canary,
				});

				canarytrace
					.withContext({
						action: "register",
					})
					.debug("Registered Canary with queue");
			}),
		);

		// biome-ignore lint/correctness/noConstructorReturn:
		return new Proxy(this, {
			apply: (target, _that, args: Parameters<Canary["handler"]>) =>
				target.handler(...args),
		});
	}

	actor() {
		const canary = this;
		const hash = this.activity.hash();
		const path = `${WorkQueueFilesystem.root}/canary/${this.name}/actor/${hash}.sqlite`;

		canary.trace
			.withContext({
				action: "actor",
			})
			.withMetadata({
				Canary: {
					actor: {
						hash,
						path,
					},
				},
			})
			.debug("Creating actor");

		return Effect.provide(
			gen(function* () {
				// const database = yield* (yield* Db0Context).database;
				// StateTable, TaskQueue, Acquire executionlog resource
				// yield* resourcelog(canary.name);
				const actor = new Actor({
					canary,
				});
				canary.trace
					.withMetadata({
						Canary: {
							actor: {
								instance: actor,
							},
						},
					})
					.debug("Created actor");
				return actor;
			}),
			Context.merge(InternalContext, Context.empty().pipe(withDb0())),
		);
	}

	handler = async (_event: unknown, _context: unknown) => {
		const canarytrace = this.trace;
		canarytrace
			.withContext({
				action: "handler",
			})
			.withMetadata({
				Canary: {
					handler: {
						event: _event,
						context: _context,
					},
				},
			})
			.debug("Canary handler() called");
		await Effect.runPromise(
			Effect.gen(function* () {
				const result = yield* mutex.withPermitsIfAvailable(1)(
					Effect.gen(function* () {
						yield* ready.await;
						canarytrace
							.withMetadata({
								signal: "ReadySignal",
								what: "await",
							})
							.debug("Received ready signal");
						yield* handler.release;
						canarytrace
							.withMetadata({
								signal: "HandlerSignal",
								what: "release",
							})
							.debug("Released handler");
						yield* done.await;
						canarytrace
							.withMetadata({
								signal: "DoneSignal",
								what: "await",
							})
							.debug("Received done signal");
					}),
				);

				pipe(
					result,
					Option.match({
						onNone: () => {
							canarytrace
								.withMetadata({
									signal: "mutex",
									what: "error",
								})
								.warn("Handler concurrency error");
						},
						onSome: () => {
							canarytrace.debug("Canary handler succeeded");
						},
					}),
				);
			}),
		);
	};
}
