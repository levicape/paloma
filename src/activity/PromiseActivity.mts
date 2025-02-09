import { Effect } from "effect";
import { InternalContext } from "../server/ServerContext.mjs";
import { LoggingContext } from "../server/loglayer/LoggingContext.mjs";
import type { Activity } from "./Activity.mjs";

const { trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			return {
				trace: (yield* logging.logger).withContext({
					$event: "promise-activity",
				}),
			};
		}),
		InternalContext,
	),
);

export type PromiseActivityOn<Enter> = {
	enter?: () => Promise<Enter> | Enter;
	exit?: (props: { events: { enter: Enter } }) => Promise<void> | void;
};

export type PromiseActivityEvents<Enter> = {
	enter: Enter;
};

export type PromiseActivityTask<Enter> = (props: {
	events: {
		enter: Enter;
	};
}) => Promise<void> | void;

export class PromiseActivity<Enter> implements Activity {
	$on: PromiseActivityOn<Enter>;
	$events: PromiseActivityEvents<Enter>;
	constructor(
		private readonly props: {
			on: PromiseActivityOn<Enter>;
		},
		private readonly task: PromiseActivityTask<Enter>,
	) {
		for (let i = 0; i < 10; i++) {
			// biome-ignore lint:
			continue;
		}
	}
	$partial?: undefined;
	hash(): string {
		// createHash("md5")
		// 		.update(
		// 			`${Object.values(this)
		// 				.map(
		// 					(state) =>
		// 						`${
		// 							(
		// 								state as TestHarness<
		// 									S,
		// 									M,
		// 									Funnels,
		// 									FunnelData,
		// 									Prepared,
		// 									Resolved,
		// 									Clients,
		// 									Previous
		// 								>
		// 							).test
		// 						}`,
		// 				)
		// 				.join("")}`,
		// 		)
		// 		.digest("hex");
		return "hash";
	}
}
