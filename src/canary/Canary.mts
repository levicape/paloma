import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Context, Effect, Option, pipe } from "effect";
import type { Tag } from "effect/Context";
import { gen, makeSemaphore } from "effect/Effect";
import type { ILogLayer } from "loglayer";
import VError from "verror";
import { Actor } from "../actor/Actor.mjs";
import type { Activity } from "../canary/activity/Activity.mjs";
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
import { PalomaRepositoryConfig } from "../repository/RepositoryConfig.mjs";
import {
	ResourceLog,
	ResourceLogFile,
} from "../repository/resourcelog/ResourceLog.mjs";
import { InternalContext } from "../server/ServerContext.mjs";
import { withWriteStream } from "../server/fs/WriteStream.mjs";
import { LoggingContext } from "../server/loglayer/LoggingContext.mjs";

const {
	config,
	logging: { trace },
	signals: { handler, done, ready, mutex },
	registry,
} = await Effect.runPromise(
	Effect.provide(
		Effect.provide(
			Effect.gen(function* () {
				const config = yield* PalomaRepositoryConfig;
				const registry = yield* ExecutionFiber;
				const logging = yield* LoggingContext;
				const trace = (yield* logging.logger).withPrefix("canary").withContext({
					$event: "canary-main",
				});

				return {
					config,
					logging: {
						trace,
					},
					signals: {
						ready: yield* yield* ReadySignal,
						handler: yield* yield* HandlerSignal,
						exit: yield* yield* ExitSignal,
						done: yield* yield* DoneSignal,
						mutex: yield* makeSemaphore(1),
					},
					registry,
				};
			}),
			InternalContext,
		),
		ExecutionFiberMain,
	),
);

export type CanaryActorDependencies = ResourceLog;
export type CanaryActorProps = {
	contextlog: Tag.Service<ResourceLog>;
};
export type CanaryProps = {};
export type CanaryIdentifiers = {
	name: string;
	hash: string;
	path: string;
};

export const CanaryResourceLogPath = () =>
	`${config.data_path}/!execution/-resourcelog/canary`;

/**
 * Canary classes define an Activity that the Paloma runtime will run on each execution.
 */
export class Canary extends Function {
	private readonly trace: ILogLayer;
	private identifiers: CanaryIdentifiers;

	constructor(
		/**
		 * Unique name for this canary. Must be URL safe alphanumeric, maximum 50 characters.
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
			canarytrace.debug("Registered actor with ExecutionFiberMain queue");
		} else {
			throw new VError(
				"Could not register Canary with ExecutionFiberMain. Exiting.",
			);
		}

		this.identifiers = (() => {
			const stack = new Error().stack;
			if (!stack) {
				throw new VError("Could not get stack trace");
			}
			const lines = stack.split("\n");
			const caller = lines[2];
			const match = caller.match(/\(([^)]+)\)/);
			if (!match) {
				throw new VError("Could not get caller from stack trace");
			}
			const path = match[1].split(":").at(-3) as string;
			const contents = readFileSync(path, "utf8");
			const hash = createHash("sha256").update(contents).digest("hex");
			return {
				name,
				hash,
				path,
			};
		})();

		// biome-ignore lint/correctness/noConstructorReturn:
		return new Proxy(this, {
			apply: (target, _that, args: Parameters<Canary["handler"]>) =>
				target.handler(...args),
		});
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
						onSome: () => {
							handlertrace.debug("Canary handler succeeded");
						},
					}),
				);
			}),
		);
	};

	private actor() {
		return ({ contextlog }: CanaryActorProps) => {
			const canary = this;

			const actortrace = canary.trace.child().withContext({
				$Canary: {
					identifiers: this.identifiers,
				},
			});

			actortrace.debug("actor() call");

			return Effect.provide(
				gen(function* () {
					const resourcelog = yield* ResourceLog;
					const actor = new Actor({
						canary,
					});
					const { traceId, spanId, parentSpanId } = actortrace.getContext();

					yield* contextlog.capture(
						"Canary-actor",
						actortrace.getContext.bind(actortrace),
					);
					yield* resourcelog.capture("Canary-actor", () => ({
						traceId,
						spanId,
						parentSpanId,
						...actor,
					}));

					actortrace
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
			).pipe(
				Effect.provide(ResourceLogFile(contextlog.scope)),
				Effect.provide(
					Context.empty().pipe(
						withWriteStream({
							name: CanaryResourceLogPath(),
							scope: contextlog.scope,
						}),
					),
				),
				Effect.scoped,
			);
		};
	}
}
