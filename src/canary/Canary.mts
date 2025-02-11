import {
	Context,
	Effect,
	ExecutionStrategy,
	Layer,
	Option,
	Scope,
	pipe,
} from "effect";
import { gen, makeSemaphore } from "effect/Effect";
import type { ILogLayer } from "loglayer";
import { ulid } from "ulidx";
import VError from "verror";
import type { Activity } from "../activity/Activity.mjs";
import { Actor } from "../actor/Actor.mjs";
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
							$event: "canary-main",
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
export const WorkQueueFilesystem = {
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
		const canarytrace = trace.child().withContext({
			$event: "canary-activity",
			$action: "constructor()",
			$Canary: {
				name,
			},
		});
		this.trace = canarytrace;
		canarytrace.debug("Canary created");

		const registered = registry.queue.unsafeOffer({
			name: this.name,
			actor: this.actor(),
		});
		if (registered) {
			canarytrace
				.withMetadata({})
				.debug("Registered self with ExecutionFiberMain queue");
		} else {
			throw new VError(
				"Could not register Canary with ExecutionFiberMain. Exiting.",
			);
		}

		// biome-ignore lint/correctness/noConstructorReturn:
		return new Proxy(this, {
			apply: (target, _that, args: Parameters<Canary["handler"]>) =>
				target.handler(...args),
		});
	}

	private actor() {
		const canary = this;
		const hash = this.activity.hash();
		const path = `${WorkQueueFilesystem.root}/canary/${this.name}/actor/${hash}.sqlite`;

		canary.trace
			.withMetadata({
				Canary: {
					actor: {
						hash,
						path,
					},
				},
			})
			.debug("actor() call");

		return Effect.provide(
			gen(function* () {
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
					.debug("Created Actor instance");
				return actor;
			}),
			Context.merge(InternalContext, Context.empty()),
		);
	}

	private handler = async (_event: unknown, _context: unknown) => {
		const handlertrace = this.trace.child().withContext({
			$event: "canary-handler",
		});

		handlertrace
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
						handlertrace
							.withMetadata({
								signal: "ReadySignal",
								what: "await",
							})
							.debug("Received ready signal");
						yield* handler.release;
						handlertrace
							.withMetadata({
								signal: "HandlerSignal",
								what: "release",
							})
							.debug("Released handler");
						yield* done.await;
						handlertrace
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
							handlertrace
								.withMetadata({
									signal: "mutex",
									what: "error",
								})
								.warn("Handler concurrency error");
						},
						onSome: (a) => {
							handlertrace.debug("Canary handler succeeded");
						},
					}),
				);
			}),
		);
	};
}
