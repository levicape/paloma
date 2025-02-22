import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Context, Effect, Option, pipe } from "effect";
import type { Tag } from "effect/Context";
import { gen, makeSemaphore } from "effect/Effect";
import type { ILogLayer } from "loglayer";
import { deserializeError } from "serialize-error";
import VError from "verror";
import { Actor } from "../actor/Actor.mjs";
import { Activity } from "../canary/activity/Activity.mjs";
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
import { RuntimeContext } from "../server/RuntimeContext.mjs";
import { withWriteStream } from "../server/fs/WriteStream.mjs";
import { LoggingContext } from "../server/loglayer/LoggingContext.mjs";
import { PromiseActivity } from "./activity/PromiseActivity.mjs";

const {
	config,
	logging: { trace },
	signals: { handler, done, ready, mutex, exit },
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
			RuntimeContext,
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
	name: Lowercase<string>;
	hash: string;
	path: string;
};

export const CanaryResourceLogPath = ({
	canary,
}: { canary: CanaryIdentifiers }) =>
	`${config.data_path}/canary/${canary.name}/-canary/actor`;

/**
 * Canary classes define an Activity that the Paloma runtime will run.
 */
export class Canary extends Function {
	private readonly trace: ILogLayer;
	public identifiers: CanaryIdentifiers;

	constructor(
		/**
		 * Unique name for this canary. Must be URL safe alphanumeric, maximum 50 characters.
		 * @see https://docs.paloma.levicape.cloud/canary-naming
		 */
		public readonly name: Lowercase<string>,
		public readonly props: CanaryProps,
		/**
		 * Activity to execute.
		 * @see Activity
		 */
		public readonly activity: Activity,
	) {
		super();

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
			const MATCH_INDEX =
				[...match].length < 2 ? Math.max(Math.max(match.length - 1, 0), 1) : 2;
			const path = match[MATCH_INDEX]?.split(":").at(-3) ?? ("" as string);
			let hash: string;
			const jsuniversalpath = path
				.replace(/\.mts$/, ".mjs")
				.replace(/\.cts$/, ".cjs")
				.replace(/\.ts$/, ".js");
			try {
				hash = `sourcejs:${createHash("sha256").update(readFileSync(path, "utf8")).digest("hex")}`;
			} catch (e: unknown) {
				try {
					hash = `sourcets:${createHash("sha256").update(readFileSync(path, "utf8")).digest("hex")}`;
				} catch (e: unknown) {
					hash = `name:${createHash("sha256").update(name).digest("hex")}`;

					trace
						.withMetadata({
							hash,
							jsuniversalpath,
							path,
						})
						.withError(deserializeError(e))
						.error(
							"Could not calculate code hash, falling back to hashed Canary name",
						);
				}
			}

			return {
				name,
				hash,
				path,
			};
		})();

		const canarytrace = trace.child().withContext({
			$event: "canary-instance",
			$action: "constructor()",
			$Canary: {
				id: this.identifiers,
			},
		});
		this.trace = canarytrace;
		canarytrace.debug("Canary created");

		const registered = registry.queue.unsafeOffer({
			identifiers: this.identifiers,
			actor: this.actor(),
		});
		if (registered) {
			canarytrace.debug("Registered actor with ExecutionFiberMain queue");
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
				$event: "canary-actor",
			});

			actortrace.debug("actor() call");

			return Effect.provide(
				gen(function* () {
					const resourcelog = yield* ResourceLog;
					const { traceId, spanId, parentSpanId } = actortrace.getContext();

					yield* contextlog.capture(
						"Canary-actor",
						actortrace.getContext.bind(actortrace),
					);
					yield* resourcelog.capture("Canary-actor", () => ({
						traceId,
						spanId,
						parentSpanId,
						...canary.identifiers,
					}));
					actortrace.debug("Captured context and resourcelog. Creating Actor");

					let actor: Actor<typeof canary>;
					try {
						actor = new Actor({
							canary,
						});
					} catch (e: unknown) {
						actortrace
							.withError(deserializeError(e))
							.error("Could not create Actor instance");

						yield* exit.open;
						throw new VError(
							deserializeError(e),
							"Could not create Actor instance",
						);
					}
					actortrace.debug("Created Actor instance");
					return actor;
				}),
				Context.merge(RuntimeContext, Context.empty()),
			).pipe(
				Effect.provide(ResourceLogFile(contextlog.scope)),
				Effect.provide(
					Context.empty().pipe(
						withWriteStream({
							name: CanaryResourceLogPath({ canary: this.identifiers }),
							scope: contextlog.scope,
						}),
					),
				),
				Effect.scoped,
			);
		};
	}
}

export { Activity, PromiseActivity };
