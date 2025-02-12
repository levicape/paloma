import { Effect } from "effect";
import { InternalContext } from "../../server/ServerContext.mjs";
import { LoggingContext } from "../../server/loglayer/LoggingContext.mjs";
import type { Activity } from "./Activity.mjs";

const { trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			return {
				trace: (yield* logging.logger).withContext({
					$event: "stateful-activity",
				}),
			};
		}),
		InternalContext,
	),
);

export type StatefulActivityOn<Prepare, Start, Enter, Stop> = {
	prepare?: () => Promise<Prepare> | Prepare;
	start?: (props: { events: { prepare: Prepare } }) => Promise<Start> | Start;
	enter?: (props: {
		events: {
			prepare: Prepare;
			start: Start;
		};
	}) => Promise<Enter> | Enter;
	exit?: (props: {
		events: {
			enter: Enter;
			prepare: Prepare;
			start: Start;
		};
	}) => Promise<void> | void;
	stop?: (props: {
		events: {
			enter: Enter;
			prepare: Prepare;
			start: Start;
		};
	}) => Promise<Stop> | Stop;
	teardown?: (props: {
		events: {
			enter: Enter;
			prepare: Prepare;
			start: Start;
			stop: Stop;
		};
	}) => Promise<void> | void;
};

export type StatefulActivityEvents<Prepare, Start, Enter, Stop> = {
	prepare: Prepare;
	start: Start;
	enter: Enter;
	stop: Stop;
};

export type StatefulActivityTask<Prepare, Start, Enter, Stop> = (props: {
	events: StatefulActivityEvents<Prepare, Start, Enter, Stop>;
}) => Promise<void> | void;

export class StatefulActivity<
	Prepare,
	Start,
	Enter,
	Stop,
	On extends StatefulActivityOn<Prepare, Start, Enter, Stop>,
> implements Activity
{
	$on: StatefulActivityOn<Prepare, Start, Enter, Stop>;
	$events: StatefulActivityEvents<Prepare, Start, Enter, Stop>;

	constructor(
		readonly props: {
			on: On;
		},
		readonly task: StatefulActivityTask<Prepare, Start, Enter, Stop>,
	) {
		for (let i = 0; i < 10; i++) {
			// biome-ignore lint:
			continue;
		}
	}
	$partial?: undefined;
	hash(): string {
		return "stateful-activity";
	}

	async plan() {}

	async handler(_event: unknown, _context: unknown) {
		await this.task({
			events: this.$events,
		});
	}
}
