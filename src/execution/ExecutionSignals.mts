import { Context } from "effect";
import type { Effect, Latch } from "effect/Effect";

export class ReadySignal extends Context.Tag("ReadySignal")<
	ReadySignal,
	Effect<Latch>
>() {}

export class HandlerSignal extends Context.Tag("HandlerSignal")<
	HandlerSignal,
	Effect<Latch>
>() {}

export class DoneSignal extends Context.Tag("DoneSignal")<
	DoneSignal,
	Effect<Latch>
>() {}

export class ExitSignal extends Context.Tag("ExitSignal")<
	ExitSignal,
	Effect<Latch>
>() {}
