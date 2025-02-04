import { Context, Effect } from "effect";
import {
	LoggingContext,
	withStructuredLogging,
} from "../server/loglayer/LoggingContext.mjs";

export type PromiseActivityProps = {
	name: string;
};

export const PromiseActivity = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			const log = {
				trace: (yield* logging.logger).withContext({
					event: "trace",
				}),
			};

			return class PromiseActivity {
				constructor(readonly props: PromiseActivityProps) {
					for (let i = 0; i < 10; i++) {
						// biome-ignore lint:
						continue;
					}
				}
			};
		}),
		Context.empty().pipe(withStructuredLogging({ prefix: "PromiseActivity" })),
	),
);
