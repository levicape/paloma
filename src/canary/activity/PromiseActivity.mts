import { Effect } from "effect";
import type { ILogLayer } from "loglayer";
import { PalomaRepositoryConfig } from "../../repository/RepositoryConfig.mjs";
import { RuntimeContext } from "../../server/RuntimeContext.mjs";
import { LoggingContext } from "../../server/loglayer/LoggingContext.mjs";
import { Activity } from "./Activity.mjs";

const { trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const config = yield* PalomaRepositoryConfig;
			const logging = yield* LoggingContext;
			const trace = (yield* logging.logger).withContext({
				$event: "activity-main[PromiseActivity]",
			});

			return {
				config,
				trace,
			};
		}),
		RuntimeContext,
	),
);

export type PromiseActivityOn<Enter> = {
	enter?: () => Promise<Enter> | Enter;
	exit?: (props: { events: { enter: Enter } }) => Promise<void> | void;
};

export type PromiseActivityEvents<Enter> = {
	enter: Enter;
};

export type PromiseActivityFunction<Enter> = (props: {
	events: {
		enter: Enter;
	};
}) => Promise<void> | void;

export class PromiseActivity<Enter> extends Activity {
	protected trace: ILogLayer;

	$on: PromiseActivityOn<Enter>;
	$events: PromiseActivityEvents<Enter> | undefined;
	constructor(
		private readonly props: {
			events: PromiseActivityOn<Enter>;
		},
		readonly task: PromiseActivityFunction<Enter>,
	) {
		super();
		this.$on = props.events;
		this.identifiers = {
			hash: "12345", //this.hash()
		};

		const unittrace = trace.child().withContext({
			$event: "activity-instance[PromiseActivity]",
			$action: "constructor()",
			$Activity: {
				id: this.identifiers,
			},
		});
		this.trace = unittrace;
		unittrace
			.withMetadata({
				PromiseActivity: {
					$class: PromiseActivity.name,
					$on: props.events,
				},
			})
			.debug("PromiseActivity created");
	}
}
