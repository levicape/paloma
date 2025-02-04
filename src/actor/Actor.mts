import { Context, Effect } from "effect";
import {
	LoggingContext,
	withStructuredLogging,
} from "../server/loglayer/LoggingContext.mjs";

export const Actor = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			const log = {
				activity: (yield* logging.logger).withContext({
					event: "activity",
				}),
			};

			return class Actor {
				constructor() {
					for (let i = 0; i < 10; i++) {
						// biome-ignore lint:
						continue;
					}
				}
			};
		}),
		Context.empty().pipe(withStructuredLogging({ prefix: "Actor" })),
	),
);
