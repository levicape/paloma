import { Effect } from "effect";
import type { ILogLayer } from "loglayer";
import { deserializeError } from "serialize-error";
import { ActorSchedule } from "../actor/ActorSchedule.mjs";
import type { ActivityIdentifiers } from "../canary/activity/Activity.mjs";
import { PalomaRepositoryConfig } from "../repository/RepositoryConfig.mjs";
import { RuntimeContext } from "../server/RuntimeContext.mjs";
import { LoggingContext } from "../server/loglayer/LoggingContext.mjs";

const { trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const config = yield* PalomaRepositoryConfig;
			const logging = yield* LoggingContext;
			const trace = (yield* logging.logger).withPrefix("task").withContext({
				$event: "task-main",
			});

			return {
				config,
				trace,
			};
		}),
		RuntimeContext,
	),
);

export type TaskDeltaFn = (...unknown: unknown[]) => Promise<unknown>;
export type TaskProps = {
	activity: ActivityIdentifiers;
	schedule: ActorSchedule;
	delta: TaskDeltaFn;
};
export class Task {
	private readonly trace: ILogLayer;
	private readonly schedule: ActorSchedule;
	private readonly deltaFn: TaskDeltaFn;
	readonly activity: ActivityIdentifiers;

	constructor(props: TaskProps) {
		this.activity = props.activity;
		this.schedule = props.schedule;
		this.deltaFn = props.delta;

		this.trace = trace.withPrefix("paloma").withContext({
			$event: "task-instance",
			$Task: {
				activity: this.activity,
			},
		});
		this.trace.info("Task created for Activity");
	}

	public delta = async () => {
		this.trace
			.withContext({
				$event: `task-delta`,
			})
			.metadataOnly({
				started: new Date().toISOString(),
				schedule: ActorSchedule.context(this.schedule),
			});

		try {
			await this.deltaFn();
		} catch (e) {
			this.trace.errorOnly(deserializeError(e));
		} finally {
			await this.schedule.next();

			this.trace.metadataOnly({
				ended: new Date().toISOString(),
				schedule: ActorSchedule.context(this.schedule),
			});
		}
	};
}
