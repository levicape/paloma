import { Context, Effect } from "effect";
import { gen, makeLatch } from "effect/Effect";
import {
	DoneSignal,
	ExitSignal,
	HandlerSignal,
	ReadySignal,
} from "../execution/ExecutionSignals.mjs";
import {
	LoggingContext,
	withStructuredLogging,
} from "./loglayer/LoggingContext.mjs";

const { signals } = await Effect.runPromise(
	gen(function* () {
		return {
			signals: (
				[
					[ReadySignal, { latch: yield* makeLatch(true) }],
					[HandlerSignal, { latch: yield* makeLatch(false) }],
					[DoneSignal, { latch: yield* makeLatch(false) }],
					[ExitSignal, { latch: yield* makeLatch(false) }],
				] as const
			).map(([tag, signal]) => ({
				tag,
				...signal,
			})),
		};
	}),
);

export const RuntimeContext = Context.empty().pipe(
	withStructuredLogging({ prefix: "otel" }),
	Context.merge(
		Context.mergeAll(
			...signals.map(({ tag, latch }) =>
				Context.empty().pipe(Context.add(tag, Effect.succeed(latch))),
			),
		),
	),
);

export { LoggingContext };
