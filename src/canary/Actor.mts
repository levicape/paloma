import { Effect } from "effect";
import { InternalContext } from "../server/ServerContext.mjs";
import { LoggingContext } from "../server/loglayer/LoggingContext.mjs";
import type { Canary } from "./Canary.mjs";

const { trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			// const handler = yield* ExecutionStage;
			return {
				// handler,
				trace: (yield* logging.logger).withContext({
					$event: "actor",
				}),
			};
		}),
		InternalContext,
	),
);

export type ActorProps<CanaryTyped extends Canary> = {
	canary: CanaryTyped;
	// workQueue: WorkQueueClient;
};

export class Actor<CanaryTyped extends Canary> {
	constructor(readonly props: ActorProps<CanaryTyped>) {
		// const hash = createHash("md5")
		// 	.update(
		// 		`${Object.values(this.states)
		// 			.map(
		// 				(state) =>
		// 					`${
		// 						(
		// 							state as TestHarness<
		// 								S,
		// 								M,
		// 								Funnels,
		// 								FunnelData,
		// 								Prepared,
		// 								Resolved,
		// 								Clients,
		// 								Previous
		// 							>
		// 						).test
		// 					}`,
		// 			)
		// 			.join("")}`,
		// 	)
		// 	.digest("hex");
		// Create execution plan
		// ExecutionPlan<{
		// }>}
	}
}
