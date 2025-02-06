import { Context } from "effect";
import type { Effect, Latch } from "effect/Effect";

export class HandlerSignal extends Context.Tag("HandlerSignal")<
	HandlerSignal,
	Effect<Latch>
>() {}

export class DoneSignal extends Context.Tag("DoneSignal")<
	DoneSignal,
	Effect<Latch>
>() {}
