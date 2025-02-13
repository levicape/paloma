import { Effect } from "effect";
import type { ILogLayer } from "loglayer";
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

		const unittrace = trace.child().withContext({
			$event: "task-instance",
			$action: "constructor()",
			$Task: {
				activity: this.activity,
				schedule: ActorSchedule.context(this.schedule),
			},
		});
		this.trace = unittrace;
		this.trace.debug("Task created");
	}

	public delta = async () => {
		this.trace
			.withContext({
				$action: "delta",
			})
			.withMetadata({
				started: new Date().toISOString(),
			})
			.debug("delta() called");
		const delta = await this.deltaFn();

		this.trace
			.withMetadata({
				ended: new Date().toISOString(),
			})
			.debug("delta() completed");

		await this.schedule.next();
	};
}
