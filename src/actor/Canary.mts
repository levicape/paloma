import { Context, Effect } from "effect";
import type { Activity } from "../activity/Activity.mjs";
import {
	LoggingContext,
	withStructuredLogging,
} from "../server/loglayer/LoggingContext.mjs";

export type CanaryProps = {
	name: string;
};

export const Canary = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			const log = {
				trace: (yield* logging.logger).withContext({
					event: "trace",
				}),
			};

			return class Canary {
				constructor(
					readonly props: CanaryProps,
					readonly activity: Activity,
				) {
					for (let i = 0; i < 10; i++) {
						// biome-ignore lint:
						continue;
					}
				}
			};
		}),
		Context.empty().pipe(withStructuredLogging({ prefix: "Canary" })),
	),
);
