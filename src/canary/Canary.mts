import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Context as AwsLambdaContext } from "aws-lambda";
import { Context, Effect, Option, Ref, pipe } from "effect";
import type { Tag } from "effect/Context";
import { gen, makeSemaphore } from "effect/Effect";
import type { ILogLayer } from "loglayer";
import { deserializeError, serializeError } from "serialize-error";
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
import {
	type HandlerContext,
	type HandlerEvent,
	HandlerEventRef,
	HandlerEventRefMain,
	type ParsedHandlerContext,
} from "../server/handler/Handler.mjs";
import { HandlerConfigMain } from "../server/handler/config/HandlerConfig.mjs";
import {
	HandlerContextRef,
	HandlerContextRefMain,
} from "../server/handler/refs/HandlerContextRef.mjs";
import { LoggingContext } from "../server/loglayer/LoggingContext.mjs";
import { PromiseActivity } from "./activity/PromiseActivity.mjs";

const {
	config: { paloma, handler: handlerConfiguration },
	logging: { trace },
	signals: { handler, done, ready, mutex, exit },
	refs,
	registry,
} = await Effect.runPromise(
	Effect.provide(
		Effect.provide(
			Effect.gen(function* () {
				const registry = yield* ExecutionFiber;
				const logging = yield* LoggingContext;
				const trace = (yield* logging.logger).withPrefix("canary").withContext({
					$event: "canary-main",
				});

				return {
					config: {
						paloma: yield* PalomaRepositoryConfig,
						handler: yield* HandlerConfigMain,
					},
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
					refs: {
						event: yield* HandlerEventRef,
						context: yield* HandlerContextRef,
					},
					registry,
				};
			}).pipe(HandlerEventRefMain, HandlerContextRefMain),
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
	`${paloma.data_path}/canary/${canary.name}/-canary/actor`;

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
			let path = "";
			let match: RegExpMatchArray | null = null;
			let jsuniversalpath: string | undefined = undefined;
			let hash: string;
			try {
				const stack = new Error().stack;
				if (!stack) {
					throw new VError("Could not get stack trace");
				}
				const lines = stack.split("\n");
				const caller = lines[lines.length - 1];
				match = caller.match(/at .*\((.*)\)/);
				if (!match) {
					throw new VError("Could not parse stack trace");
				}
				path =
					fileURLToPath(match[1]?.trim() ?? "file://")?.split(":")?.[0] ?? "";
				jsuniversalpath = path
					.replace(/\.mts$/, ".mjs")
					.replace(/\.cts$/, ".cjs")
					.replace(/\.ts$/, ".js");
				hash = `sourcejs:${createHash("sha256").update(readFileSync(jsuniversalpath, "utf8")).digest("hex")}`;
			} catch (e: unknown) {
				try {
					hash = `sourcets:${createHash("sha256").update(readFileSync(path, "utf8")).digest("hex")}`;
				} catch (e: unknown) {
					hash = `name:${createHash("sha256").update(name).digest("hex")}`;

					trace
						.withMetadata({
							err: serializeError(e),
							hash,
							jsuniversalpath,
							match,
							path,
						})
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

	private updateRefs = async (event: HandlerEvent, context: HandlerContext) => {
		return Effect.gen(function* () {
			yield* Ref.update(refs.event, (_) => event);

			if (handlerConfiguration.aws.AWS_LAMBDA_FUNCTION_NAME !== undefined) {
				const handlerContext: ParsedHandlerContext = {
					$kind: "AwsLambdaHandlerContext",
					aws: context as AwsLambdaContext,
				};
				yield* Ref.update(refs.context, (_) => handlerContext);
			}
		});
	};
	private handler = async (event: HandlerEvent, context: HandlerContext) => {
		const handlertrace = this.trace.child().withContext({
			$event: "canary-handler",
		});

		handlertrace
			.withMetadata({
				Canary: {
					handler: {
						event,
						context,
					},
				},
			})
			.debug("Canary handler() called");

		const updateRefs = await this.updateRefs(event, context);

		await Effect.runPromise(
			Effect.gen(function* () {
				const result = yield* mutex.withPermitsIfAvailable(1)(
					Effect.gen(function* () {
						yield* updateRefs;

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
