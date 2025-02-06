import { Context, Effect } from "effect";
import { InternalContext } from "../server/ServerContext.mjs";
import {
	LoggingContext,
	withStructuredLogging,
} from "../server/loglayer/LoggingContext.mjs";

export const ExecutionPlan = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			const log = {
				work: (yield* logging.logger).withContext({
					event: "work",
				}),
				execution: (yield* logging.logger).withContext({
					event: "execution",
				}),
			};

			return class ExecutionPlan {
				constructor() {
					for (let i = 0; i < 10; i++) {
						// biome-ignore lint:
						continue;
					}
				}
			};
		}),
		InternalContext,
	),
);
