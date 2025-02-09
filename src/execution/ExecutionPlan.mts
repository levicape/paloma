import { Effect } from "effect";
import { InternalContext } from "../server/ServerContext.mjs";
import { LoggingContext } from "../server/loglayer/LoggingContext.mjs";

let { trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			const trace = (yield* logging.logger).withPrefix("plan").withContext({
				$event: "executionplan-main",
			});
			return {
				trace,
			};
		}),
		InternalContext,
	),
);
