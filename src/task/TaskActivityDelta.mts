import { Effect } from "effect";
import VError from "verror";
import type { Activity } from "../canary/activity/Activity.mjs";
import { PromiseActivity } from "../canary/activity/PromiseActivity.mjs";
import { PalomaRepositoryConfig } from "../repository/RepositoryConfig.mjs";
import { RuntimeContext } from "../server/RuntimeContext.mjs";
import { LoggingContext } from "../server/loglayer/LoggingContext.mjs";
import type { TaskDeltaFn } from "./Task.mjs";
import { PromiseTaskActivityDelta } from "./delta/PromiseTaskActivityDelta.mjs";

let { trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const config = yield* PalomaRepositoryConfig;
			const logging = yield* LoggingContext;
			const trace = (yield* logging.logger).withPrefix("delta").withContext({
				$event: "taskactivitydelta-main",
			});
			const { rootId } = trace.getContext();

			return {
				rootId,
				config,
				trace,
			};
		}),
		RuntimeContext,
	),
);

export const TaskActivityDelta = (activity: Activity): TaskDeltaFn => {
	let activitytrace = trace.child().withContext({
		$event: "taskactivitydelta-instance",
		$TaskActivityDelta: {
			activity: activity.identifiers,
		},
	});
	activitytrace.debug("TaskActivityDelta()");

	return () => {
		if (activity instanceof PromiseActivity) {
			activitytrace.debug("Promise-based TaskActivityDelta");
			return PromiseTaskActivityDelta(activity);
		}

		activitytrace.error("Could not process TaskActivityDelta");
		throw new VError(
			{
				info: {
					activity,
				},
			},
			"Could not process TaskActivityDelta",
		);
	};
};
