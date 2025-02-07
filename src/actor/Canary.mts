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

type Otel = {
	traceId: string;
	spanId: string;
	rootSpanId?: string;
};

/**
 * Canary classes define an Activity that the Paloma runtime will run on each execution.
 */
export class Canary {
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
		const canary = this;
		const canarytrace = trace.child().withContext({
			event: "canary-activity",
			action: "create",
			$CanaryActivity: {
				name,
				activity: activity.constructor.name,
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
		const path = `${WorkQueueFilesystem.root}/canary/${this.name}/actor/${hash}.sqlite`;
		const otel = {
			traceId: ulid(),
			spanId: ulid(),
		};

		return Effect.provide(
			gen(function* () {
				// const database = yield* (yield* Db0Context).database;
				// StateTable, TaskQueue, Acquire executionlog resource
				canary.trace
					.withContext({
						action: "create",
					})
					.withMetadata({
						...otel,
						Canary: {
							actor: {
								hash,
								path,
							},
						},
					})
					.debug("Creating actor");
				// yield* resourcelog(canary.name);
				return new Actor({
					canary,
				});
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
			.debug("Canary handler");
		await Effect.runPromise(
			Effect.gen(function* () {
				const result = yield* mutex.withPermitsIfAvailable(1)(
					Effect.gen(function* () {
						canarytrace
							.withContext({
								signal: "HandlerSignal",
								what: "await",
							})
							.debug("Waiting for handler to be ready");
						yield* ready.await;
						canarytrace
							.withContext({
								signal: "HandlerSignal",
								what: "release",
							})
							.debug("Signal handler is ready");
						yield* handler.release;
						canarytrace
							.withContext({
								signal: "DoneSignal",
								what: "await",
							})
							.debug("Waiting for ExecutionFiberMain to finish");
						yield* done.await;
					}),
				);

				pipe(
					result,
					Option.match({
						onNone: () => {
							canarytrace
								.withContext({
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
