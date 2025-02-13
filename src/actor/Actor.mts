import { Context, Effect } from "effect";
import type { Tag } from "effect/Context";
import { gen } from "effect/Effect";
import type { ILogLayer } from "loglayer";
import { deserializeError } from "serialize-error";
import VError from "verror";
import type { Canary } from "../canary/Canary.mjs";
import type { Activity } from "../canary/activity/Activity.mjs";
import { ExecutionPlan } from "../execution/ExecutionPlan.mjs";
import { ExitSignal } from "../execution/ExecutionSignals.mjs";
import { PalomaRepositoryConfig } from "../repository/RepositoryConfig.mjs";
import {
	ResourceLog,
	ResourceLogFile,
} from "../repository/resourcelog/ResourceLog.mjs";
import { RuntimeContext } from "../server/RuntimeContext.mjs";
import { withWriteStream } from "../server/fs/WriteStream.mjs";
import { LoggingContext } from "../server/loglayer/LoggingContext.mjs";
import { ActorSchedule } from "./ActorSchedule.mjs";

const { config, trace, exit } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const config = yield* PalomaRepositoryConfig;
			const logging = yield* LoggingContext;
			const trace = (yield* logging.logger).withContext({
				$event: "actor-main",
			});
			const exit = yield* ExitSignal;

			return {
				config,
				trace,
				exit,
			};
		}),
		RuntimeContext,
	),
);

export type ActorPlanProps = {
	contextlog: Tag.Service<ResourceLog>;
};

export type ActorIdentifiers = {
	name: string;
	hash: string;
};

export type ActorProps<CanaryTyped extends Canary> = {
	canary: CanaryTyped;
};

export const ActorResourceLogPath = ({ actor }: { actor: ActorIdentifiers }) =>
	`${config.data_path}/canary/${actor.name}/-actor/plan`;

export class Actor<CanaryTyped extends Canary> {
	private readonly trace: ILogLayer;
	private readonly activity: Activity;
	public identifiers: ActorIdentifiers;

	constructor(readonly props: ActorProps<CanaryTyped>) {
		this.identifiers = {
			name: props.canary.identifiers.name,
			hash: props.canary.identifiers.hash,
		};
		this.activity = props.canary.activity;

		this.trace = trace.child().withContext({
			$event: "actor-instance",
			$action: "constructor()",
			$Actor: {
				id: this.identifiers,
				activity: this.activity.identifiers,
			},
		});
		this.trace.debug("Actor created");
	}

	plan() {
		this.trace.debug("plan() call");

		return ({ contextlog }: ActorPlanProps) => {
			const actor = this;
			const plantrace = actor.trace.child().withContext({
				$event: "actor-plan",
			});

			plantrace.debug("plan() call");

			return Effect.provide(
				gen(function* () {
					const resourcelog = yield* ResourceLog;
					const { traceId, spanId, parentSpanId } = plantrace.getContext();

					yield* contextlog.capture(
						"Actor-plan",
						plantrace.getContext.bind(plantrace),
					);
					yield* resourcelog.capture("Actor-plan", () => ({
						traceId,
						spanId,
						parentSpanId,
						...actor.identifiers,
					}));

					let plan: ExecutionPlan;
					try {
						plan = new ExecutionPlan({
							actor: actor.identifiers,
							activity: actor.activity,
							schedule: new ActorSchedule(),
						});
					} catch (e: unknown) {
						plantrace
							.withError(deserializeError(e))
							.error("Could not create ExecutionPlan instance");

						yield* (yield* exit).open;

						throw new VError(
							deserializeError(e),
							"Could not create ExecutionPlan instance",
						);
					}

					plantrace.debug("Created ExecutionPlan instance");
					return {
						plan,
					};
				}),
				Context.merge(RuntimeContext, Context.empty()),
			).pipe(
				Effect.provide(ResourceLogFile(contextlog.scope)),
				Effect.provide(
					Context.empty().pipe(
						withWriteStream({
							name: ActorResourceLogPath({ actor: actor.identifiers }),
							scope: contextlog.scope,
						}),
					),
				),
				Effect.scoped,
			);
		};
	}
}
