import { Context, Effect } from "effect";
import { gen, makeLatch } from "effect/Effect";
import { DoneSignal, HandlerSignal } from "../execution/ExecutionSignals.mjs";
import { withStructuredLogging } from "./loglayer/LoggingContext.mjs";

const { done, handler } = await Effect.runPromise(
	gen(function* () {
		return {
			done: yield* makeLatch(),
			handler: yield* makeLatch(),
		};
	}),
);

export const InternalContext = Context.empty().pipe(
	withStructuredLogging({ prefix: "internal" }),
	Context.add(
		HandlerSignal,
		gen(function* () {
			yield* Effect.void;
			return handler;
		}),
	),
	Context.add(
		DoneSignal,
		gen(function* () {
			yield* Effect.void;
			return done;
		}),
	),
);
