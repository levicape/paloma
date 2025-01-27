import { createHash } from "node:crypto";
import { DebugLog } from "../debug/DebugLog.mjs";
import {
	type PrimitiveObject,
	WorkQueueClient,
} from "../repository/workqueue/WorkQueueClient.mjs";
import type { WorkQueueExecutionTable } from "../repository/workqueue/WorkQueueExecutionTable.mjs";
import { WorkQueueFilesystem } from "../repository/workqueue/WorkQueueFilesystem.mjs";
import type { AlltestOptions } from "./AlltestOptions.mjs";
import type { AlltestSetup } from "./AlltestSetup.mjs";
import type { Funnel } from "./Funnel.mjs";
import type { ContinueAction, TestAction } from "./TestAction.mjs";
import type { TestHarness } from "./TestHarness.mjs";

type BrowserClient<M extends string, Funnels extends string> = {
	screenshots: {
		capture: (name: Funnels, data: string, metric?: M) => void;
	};
};

type HttpClient = {
	fetch: typeof fetch;
};

type DefaultClients<M extends string, Funnels extends string> = {
	http: HttpClient;
	browser: BrowserClient<M, Funnels>;
	assertion: {
		ok: (condition: boolean, message: string) => void;
	};
	metrics: {
		increment: (name: M) => void;
	};
	log: {
		debug: (...args: unknown[]) => void;
		warn: (...args: unknown[]) => void;
	};
};

const harnessDebug = DebugLog("HARNESS", (message: unknown) => ({
	Alltest: {
		harness: message,
	},
}));

const stateDebug = DebugLog("STATE", (message: unknown) => ({
	Alltest: {
		state: message,
	},
}));

export type DefaultHandlerEvent = Record<string, unknown>;
export type DefaultHandlerContext = Record<string, unknown>;

export class Alltest<
	Funnels extends string,
	M extends string,
	FunnelData extends Array<Funnel<Funnels>> = Array<Funnel<Funnels>>,
	Clients extends Record<string, unknown> = DefaultClients<M, Funnels>,
	HandlerEvent extends Record<string, unknown> = DefaultHandlerEvent,
	HandlerContext extends Record<string, unknown> = DefaultHandlerContext,
	Prepared = PrimitiveObject,
	Resolved = Record<string, unknown>,
	S extends string = string,
	// biome-ignore lint/suspicious/noExplicitAny:
	Previous extends TestAction<S, TestAction<S, any>> = TestAction<S, any>,
	Context extends Record<string, unknown> = Record<string, unknown>,
> {
	private started = false;
	constructor(
		private setup: AlltestSetup<Prepared, Resolved>,
		private states: {
			[state in S]: TestHarness<
				S,
				M,
				Funnels,
				FunnelData,
				Prepared,
				Resolved,
				Clients,
				Previous
			>;
		},
		private options: AlltestOptions<S>,
	) {
		if (process.env._HANDLER === undefined) {
			setTimeout(() => {
				if (!this.started) {
					this.handler({} as HandlerEvent, {} as HandlerContext);
				}
			}, 1000);
		}
	}

	private async allReady() {
		await WorkQueueFilesystem.ready();
	}

	public handler = async (
		_event: HandlerEvent,
		_handlercontext: HandlerContext,
	) => {
		if (this.started) {
			throw new Error("Alltest handler already started");
		}
		this.started = true;
		const hash = createHash("md5")
			.update(
				`${Object.values(this.states)
					.map(
						(state) =>
							`${
								(
									state as TestHarness<
										S,
										M,
										Funnels,
										FunnelData,
										Prepared,
										Resolved,
										Clients,
										Previous
									>
								).test
							}`,
					)
					.join("")}`,
			)
			.digest("hex");

		harnessDebug(
			{
				message: "AllTest handler",
				name: this.options.name,
				hash: hash.toString(),
			},
			this.options,
		);

		await this.allReady();
		const [workQueue] = [WorkQueueClient].map((table) => {
			return new table({
				test: this.options.name,
				hash: hash.toString(),
			});
		});

		const { executionTable } = workQueue;
		const http = {
			fetch: fetch,
		};
		const browser: DefaultClients<M, Funnels>["browser"] = {
			screenshots: {
				capture: (name: Funnels, data: string, metric?: M) => {
					console.log({
						Test: {
							name: this.options.name,
							hash: hash.toString(),
						},
						Screenshot: {
							name,
							data,
							metric,
						},
					});
				},
			},
		};
		const assertion = {
			ok: (condition: boolean, message: string) => {
				if (!condition) {
					throw new Error(message);
				}
			},
		};
		const metrics = {
			increment: (name: M) => {
				console.log({
					Test: {
						name: this.options.name,
						hash: hash.toString(),
					},
					Metric: {
						name,
					},
				});
			},
		};
		const log = {
			debug: (args: unknown) => {
				console.dir(args, { depth: null });
			},
			warn: console.warn,
			state: console.dir,
			orchestration: console.dir,
			execution: console.dir,
		};
		const clients: DefaultClients<M, Funnels> = {
			http,
			browser,
			assertion,
			metrics,
			log,
		};
		const context: Context = {} as unknown as Context;
		harnessDebug(
			{
				message: "Running test",
				name: this.options.name,
				entry: this.options.entry(),
			},
			{ context, clients },
		);

		const result = await this.run(clients, context, workQueue, executionTable);
		console.log({
			Test: {
				name: this.options.name,
				hash: hash.toString(),
			},
			Result: result,
		});

		return {
			statusCode: 200,
			body: JSON.stringify(result),
		};
	};

	public async run(
		clients: DefaultClients<M, Funnels>,
		context: Context,
		workQueue: WorkQueueClient,
		executionTable: WorkQueueExecutionTable,
	) {
		// Check for existing setup.
		// Run the setup function.
		// this.options.setup?.({ context, clients });

		// Generate keypair
		// const keypair = this.options.keypair?.({ setup });

		return await this.work(clients, context, workQueue, executionTable);
	}

	public async work(
		clients: DefaultClients<M, Funnels>,
		context: Context,
		workQueue: WorkQueueClient,
		executionTable: WorkQueueExecutionTable,
	) {
		let workItem = workQueue.dequeue();
		let prepared: Prepared | undefined;
		if (!workItem) {
			const maxConcurrent = this.options.maxConcurrent ?? 1;
			if (maxConcurrent > 1) {
				// const concurrent = await workQueue.concurrent();
				// if (concurrent >= maxConcurrent) {
				// 	return { success: true };
				// }
			}

			if (this.setup.prepare) {
				prepared = await this.setup.prepare?.();
			}

			workQueue.enqueue({
				stateFn: this.options.entry(),
				// biome-ignore lint/style/noNonNullAssertion:
				prepared: prepared!,
				action: {
					kind: "noop",
				},
			});
			workItem = workQueue.dequeue();
			harnessDebug(
				{
					message: "Running test",
					name: this.options.name,
					entry: this.options.entry(),
				},
				workItem,
			);
		} else {
			harnessDebug(
				{
					message: "Resuming test",
					name: this.options.name,
					workId: workItem.workId,
				},
				workItem,
			);
			prepared = (workItem.prepared as Prepared) ?? ({} as Prepared);
		}

		if (prepared === undefined) {
			prepared = {} as Prepared;
		}

		let previousExecutionId: string | undefined;
		let previousWorkId: number | undefined = workItem?.workId;
		let previousAction: TestAction<S, Previous, PrimitiveObject> =
			(workItem?.action as unknown as TestAction<
				S,
				Previous,
				PrimitiveObject
			>) ?? { kind: "noop" };

		let resolved: Resolved;
		if (this.setup.resolve) {
			resolved = await this.setup.resolve({ prepared });
		} else {
			resolved = {} as unknown as Resolved;
		}

		while (workItem) {
			const state = this.states[workItem.stateFn as S];
			const handler = state.test;
			clients.assertion.ok(
				handler !== undefined,
				`State ${workItem.stateFn} does not have a handler`,
			);

			harnessDebug(
				{
					message: "Resolving",
					state: workItem.stateFn,
					workId: workItem.workId,
				},
				{ context, clients },
			);

			stateDebug(
				{
					message: "Running",
					state: workItem.stateFn,
					workId: workItem.workId,
					previousExecutionId,
				},
				{
					previousAction,
					prepared,
					resolved,
				},
			);

			const action: TestAction<S, Previous, PrimitiveObject> = await handler({
				actions: {
					continue: (opts: ContinueAction<S, PrimitiveObject>) => ({
						kind: "continue",
						...opts,
					}),
					fail: ({
						message,
					}: { message?: string } & Record<string, unknown>) => ({
						kind: "fail",
						message,
					}),
					pass: (result: Record<string, unknown>) => ({ kind: "pass", result }),
					skip: () => ({ kind: "skip" }),
					retry: (opts?: { to?: S; metric?: M }) => ({
						kind: "retry",
						to: opts?.to,
						...opts,
					}),
				},
				id: workItem.workId,
				state: workItem.stateFn as S,
				resolved,
				prepared,
				clients: clients as unknown as Clients,
				previous: previousAction,
				execution: { log: [] },
				funnel: [] as unknown as FunnelData,
			});
			previousAction = action;

			stateDebug(
				{
					message: "Completed",
					workId: workItem.workId,
					state: workItem.stateFn,
					previousExecutionId,
				},
				{
					action,
				},
				"INFO",
			);

			if (previousWorkId !== workItem.workId) {
				previousExecutionId = undefined;
			}

			const { workExecutionId } = await executionTable.upsert(workItem, {
				created: new Date().toISOString(),
				processing: new Date().toISOString(),
				previousExecutionId,
				result: action as PrimitiveObject,
				resolved: resolved as PrimitiveObject,
				// meta:
			});

			const { workId, action: previous } = workItem;
			switch (action.kind) {
				case "continue": {
					await workQueue.enqueue({
						workId,
						stateFn: action.to ?? this.options.entry(),
						prepared: prepared as PrimitiveObject,
						action: action as TestAction<string>,
					});
					break;
				}
				case "retry": {
					const previousAction = previous as unknown as TestAction<
						S,
						Previous,
						PrimitiveObject
					>;
					if (previousAction.kind === "retry") {
						// executionTable.countRetries({
						// 	workId,
						// 	previous: previousAction.to,
						// 	to: action.to,
						// });
					}

					await workQueue.enqueue({
						workId,
						stateFn: action.to ?? this.options.entry(),
						prepared: prepared as PrimitiveObject,
						action,
					});
					break;
				}
			}
			await executionTable.upsert(workItem, {
				workExecutionId,
				completed: new Date().toISOString(),
			});

			switch (action.kind) {
				// @biomejs-ignore lint/suspicious/noFallthroughSwitchClause:
				case "fail": {
					stateDebug(`Failed: ${action.message}`, action);
					workQueue.complete({
						workId,
						result: action as PrimitiveObject,
					});
					return { success: false };
				}
				case "pass": {
					stateDebug("Passed", action);
					workQueue.complete({
						workId,
						result: action as PrimitiveObject,
					});
					return { success: true };
				}
			}
			previousExecutionId = workExecutionId;
			previousWorkId = workItem.workId;

			workItem = workQueue.dequeue();
		}

		return { success: true };
	}
}
