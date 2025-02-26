import { Context, Effect, Option } from "effect";
import { gen } from "effect/Effect";
import type { ILogLayer } from "loglayer";
import { deserializeError, serializeError } from "serialize-error";
import VError from "verror";
import type { ActorIdentifiers, ActorPlanProps } from "../actor/Actor.mjs";
import { ActorSchedule } from "../actor/ActorSchedule.mjs";
import type { Activity } from "../canary/activity/Activity.mjs";
import { PalomaRepositoryConfig } from "../repository/RepositoryConfig.mjs";
import { ResourceLog } from "../repository/resourcelog/ResourceLog.mjs";
import { RuntimeContext } from "../server/RuntimeContext.mjs";
import { LoggingContext } from "../server/loglayer/LoggingContext.mjs";
import { Task } from "../task/Task.mjs";
import { TaskActivityDelta } from "../task/TaskActivityDelta.mjs";
import { ExitSignal } from "./ExecutionSignals.mjs";

const { config, trace, exit } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const config = yield* PalomaRepositoryConfig;
			const logging = yield* LoggingContext;
			const trace = (yield* logging.logger).withPrefix("plan").withContext({
				$event: "executionplan-main",
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

export type ExecutionPlanProps = {
	actor: ActorIdentifiers;
	schedule: ActorSchedule;
	activity: Activity;
};
export class ExecutionPlan {
	private trace: ILogLayer;
	private actor: ActorIdentifiers;
	private activity: Activity;
	private schedule: ActorSchedule;

	static context(of: ExecutionPlan) {
		return {
			schedule: ActorSchedule.context(of.schedule),
		};
	}

	constructor({ actor, schedule, activity }: ExecutionPlanProps) {
		const tasktrace = trace.child().withContext({
			$event: "executionplan-instance",
			$action: "constructor()",
			$ExecutionPlan: {
				actor: actor,
				activity: activity.identifiers,
			},
		});
		this.actor = actor;
		this.schedule = schedule;
		this.activity = activity;
		this.trace = tasktrace;
		this.trace.debug("ExecutionPlan created");
	}
	task({ contextlog }: ActorPlanProps) {
		const plan = this;

		this.trace.debug("task() call");

		return () => {
			const tasktrace = plan.trace.child().withContext({
				$event: "executionplan-task",
			});
			tasktrace.debug("plantask() call");

			return Effect.provide(
				gen(function* () {
					const resourcelog = yield* ResourceLog;
					const { traceId, spanId, parentSpanId } = tasktrace.getContext();

					yield* contextlog.capture(
						"ExecutionPlan-task",
						tasktrace.getContext.bind(tasktrace),
					);

					tasktrace.debug("Context captured. Proceeding with ActorSchedule");
					try {
						const proceed = yield* Effect.promise(() =>
							plan.schedule.proceed(),
						);

						if (!proceed) {
							tasktrace.debug("ActorSchedule did not proceed");
							return Option.none();
						}
					} catch (e: unknown) {
						const message = "Could not proceed with ActorSchedule";
						tasktrace
							.withMetadata({
								ExecutionPlanTask: {
									actor: plan.actor,
									activity: plan.activity.identifiers,
									schedule: plan.schedule,
								},
								err: serializeError(e),
							})
							.error(message);

						yield* (yield* exit).open;

						throw new VError(deserializeError(e), message);
					}

					let task: Task;
					try {
						task = new Task({
							activity: plan.activity.identifiers,
							schedule: plan.schedule,
							delta: TaskActivityDelta(plan.activity),
						});
					} catch (e: unknown) {
						tasktrace
							.withError(deserializeError(e))
							.error("Could not create Task instance");

						yield* (yield* exit).open;

						throw new VError(
							deserializeError(e),
							"Could not create Task instance",
						);
					}

					yield* resourcelog.capture("ExecutionPlan-task", () => ({
						traceId,
						spanId,
						parentSpanId,
						...plan.actor,
						...task.activity,
					}));

					tasktrace.debug("Created Task instance");

					return Option.some({ task });
				}),
				Context.merge(RuntimeContext, Context.empty()),
			).pipe(Effect.scoped);
		};
	}
}
