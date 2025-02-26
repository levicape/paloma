import { Context, Effect, Ref } from "effect";
import type { ParsedHandlerContext } from "../Handler.mjs";

const parsedHandlerContext = Ref.make<ParsedHandlerContext>({
	$kind: "VoidHandlerContext",
});

export class HandlerContextRef extends Context.Tag("HandlerContextRef")<
	HandlerContextRef,
	Ref.Ref<ParsedHandlerContext>
>() {}

export const HandlerContextRefMain = Effect.provideServiceEffect(
	HandlerContextRef,
	parsedHandlerContext,
);
