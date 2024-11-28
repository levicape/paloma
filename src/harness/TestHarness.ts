import type { PrimitiveObject } from "../repository/workqueue/index.ts";
import type { Funnel } from "./Funnel.js";
import type { ContinueActionProps, TestAction } from "./TestAction.js";

type AllPrimitive = PrimitiveObject;

export type TestProps<
	S extends string,
	M extends string,
	Funnels extends string,
	FunnelData extends Array<Funnel<Funnels>>,
	Prepared,
	Resolved,
	Clients,
	Previous extends TestAction<S>,
	Next extends AllPrimitive | undefined,
> = {
	id: number;
	state: S;
	resolved: Resolved;
	prepared: Prepared;
	clients: Clients;
	actions: {
		continue: (
			opts: ContinueActionProps<S, Next, Funnels>,
		) => TestAction<S, Previous, Next>;
		fail: (opts: { message?: string | undefined; metric?: M }) => TestAction<
			S,
			Previous,
			Next
		>;
		pass: (opts: { result: Record<string, unknown>; metric?: M }) => TestAction<
			S,
			Previous,
			Next
		>;
		skip: (opts: { result: Record<string, unknown>; metric?: M }) => TestAction<
			S,
			Previous,
			Next
		>;
		retry: (opts?: { to?: S; metric?: M }) => TestAction<S, Previous, Next>;
	};
	previous?: TestAction<S, Previous, Next>;
	execution: { log: unknown[] };
	funnel: FunnelData;
};

export type TestFunction<
	S extends string,
	M extends string,
	Funnels extends string,
	FunnelData extends Array<Funnel<Funnels>>,
	Prepared,
	Resolved,
	Clients,
	Previous extends TestAction<S>,
	Next extends AllPrimitive,
> = (
	args: TestProps<
		S,
		M,
		Funnels,
		FunnelData,
		Prepared,
		Resolved,
		Clients,
		Previous,
		Next
	>,
) => TestAction<S, Previous, Next> | Promise<TestAction<S, Previous, Next>>;

// This type defines the structure of a test harness, which includes:
// - test: The main test function that executes the test logic.
// - after: An optional function to be executed after the test function.
// - teardown: An optional function to be executed for cleanup after the test.
export type TestHarness<
	S extends string,
	M extends string,
	Funnels extends string,
	FunnelData extends Array<Funnel<Funnels>>,
	Prepared,
	Resolved,
	Clients,
	Previous extends TestAction<S, TestAction<S>>,
	Next extends AllPrimitive = AllPrimitive,
> = {
	test: TestFunction<
		S,
		M,
		Funnels,
		FunnelData,
		Prepared,
		Resolved,
		Clients,
		Previous,
		Next
	>;
	cleanup?: (opts: {
		prepared: Prepared;
		resolved: Resolved;
		clients: Clients;
	}) => Promise<void>;
};
