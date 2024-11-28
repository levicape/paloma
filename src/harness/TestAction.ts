import type {
	Primitive,
	PrimitiveObject,
} from "../repository/workqueue/index.js";

export type ContinueActionProps<
	S,
	Next extends PrimitiveObject | undefined = undefined,
	Funnels extends string = string,
> = {
	to: S;
	wait?: number;
	data?: Next;
	funnel?: Funnels;
};

export type ContinueAction<
	S = string,
	Next extends PrimitiveObject | undefined = PrimitiveObject | undefined,
> = {
	to: S;
	afterIso?: string;
	data?: Next;
};

export type TestAction<
	S extends string,
	// biome-ignore lint/suspicious/noExplicitAny:
	Previous extends TestAction<S, TestAction<S, any>> = TestAction<S, any>,
	Next extends PrimitiveObject | undefined = undefined,
> =
	| (ContinueAction<S, Next> & { kind: "continue" })
	| { kind: "fail"; message?: string; previous?: Previous }
	| { kind: "pass"; result: Record<string, unknown>; previous?: Previous }
	| { kind: "skip" }
	| { kind: "noop" }
	| { kind: "retry"; to?: S; data?: Previous; afterIso?: string };
