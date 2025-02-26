import { Context, Effect, Ref } from "effect";
import type { HandlerEvent } from "../Handler.mjs";

const parsedHandlerEvent = Ref.make<HandlerEvent>(undefined);

export class HandlerEventRef extends Context.Tag("HandlerEventRef")<
	HandlerEventRef,
	Ref.Ref<HandlerEvent>
>() {}

export const HandlerEventRefMain = Effect.provideServiceEffect(
	HandlerEventRef,
	parsedHandlerEvent,
);
