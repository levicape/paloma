import { createHash } from "node:crypto";
import { Context, Effect } from "effect";
import VError from "verror";
import {
	type PrimitiveObject,
	WorkQueueClient,
} from "../repository/workqueue/WorkQueueClient.mjs";
import type { WorkQueueExecutionTable } from "../repository/workqueue/WorkQueueExecutionTable.mjs";
import { WorkQueueFilesystem } from "../repository/workqueue/WorkQueueFilesystem.mjs";
import {
	LoggingContext,
	withStructuredLogging,
} from "../server/loglayer/LoggingContext.mjs";
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

const { work, execution } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			return {
				work: (yield* logging.logger).withContext({
					event: "work",
				}),
				execution: (yield* logging.logger).withContext({
					event: "execution",
				}),
			};
		}),
		Context.empty().pipe(withStructuredLogging({ prefix: "ExecutionPlan" })),
	),
);

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
			throw new VError("Alltest handler already started");
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

		execution
			.withContext({
				name: this.options.name,
				hash: hash.toString(),
			})
			.debug("Starting AllTest handler");

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
					throw new VError(message);
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
		// TODO: Loglayer
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
		execution
			.withMetadata({
				ExecutionPlan: {
					entry: this.options.entry(),
					context,
					clients,
				},
			})
			.debug("Starting");

		const result = await this.run(clients, context, workQueue, executionTable);

		work
			.withMetadata({
				ExecutionPlan: {
					result,
				},
			})
			.info("Completed");
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
		let logbuilder = execution
			.withContext({
				workId: workItem?.workId,
				action: workItem?.action,
				state: workItem?.stateFn,
			})
			.withMetadata({
				ExecutionPlan: {
					work: {
						name: this.options.name,
						prepared: workItem?.prepared,
						result: workItem?.result,
						completed: workItem?.completed,
						processing: workItem?.processing,
						created: workItem?.created,
					},
				},
			});
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
			logbuilder.debug("Running test");
		} else {
			logbuilder.debug("Resuming test");

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

			execution
				.withContext({
					workId: workItem.workId,
					action: workItem.action,
					state: workItem.stateFn,
				})
				.debug("Work item");

			work
				.withContext({
					workId: workItem.workId,
					action: workItem.action,
					state: workItem.stateFn,
				})
				.withMetadata({
					ExecutionPlan: {
						previous: previousWorkId
							? {
									workId: previousWorkId,
									executionId: previousExecutionId,
									action: previousAction,
								}
							: undefined,
						work: {
							prepared,
							resolved,
						},
					},
				})
				.debug("Resolving");

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
			if (previousWorkId !== workItem.workId) {
				previousExecutionId = undefined;
			}

			work
				.withContext({
					action,
				})
				.withMetadata({
					ExecutionPlan: {
						previous: {
							executionId: previousExecutionId,
							action: previousAction,
						},
						work: {
							state: workItem.stateFn,
							action: workItem.action,
						},
					},
				})
				.info("Completed");

			execution
				.withContext({
					action,
				})
				.withMetadata({
					ExecutionPlan: {
						previous: {
							executionId: previousExecutionId,
							action: previousAction,
						},
						work: {
							result: action,
						},
					},
				})
				.debug("Executing Action results");

			const { workExecutionId } = await executionTable.upsert(workItem, {
				created: new Date().toISOString(),
				processing: new Date().toISOString(),
				previousExecutionId,
				result: action as PrimitiveObject,
				resolved: resolved as PrimitiveObject,
			});

			const { workId, action: previousWorkAction } = workItem;
			const actionlog = work
				.withContext({
					workId,
					workExecutionId,
					state: action.to ?? this.options.entry(),
				})
				.withMetadata({
					ExecutionPlan: {
						execution: {
							executionId: previousExecutionId,
							action: previousWorkAction,
						},
					},
				});
			switch (action.kind) {
				case "continue": {
					actionlog.debug("Continuing");
					await workQueue.enqueue({
						workId,
						stateFn: action.to ?? this.options.entry(),
						prepared: prepared as PrimitiveObject,
						action: action as TestAction<string>,
					});
					break;
				}
				case "retry": {
					const previousAction = previousWorkAction as unknown as TestAction<
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

					actionlog.debug("Retrying");

					await workQueue.enqueue({
						workId,
						stateFn: action.to ?? this.options.entry(),
						prepared: prepared as PrimitiveObject,
						action,
					});
					break;
				}
			}

			execution
				.withContext({
					workId,
					action,
					workExecutionId,
					state: action.to ?? this.options.entry(),
				})
				.debug("Completing work Action");

			await executionTable.upsert(workItem, {
				workExecutionId,
				completed: new Date().toISOString(),
			});

			switch (action.kind) {
				// @biomejs-ignore lint/suspicious/noFallthroughSwitchClause:
				case "fail": {
					work.warn("Failed");

					workQueue.complete({
						workId,
						result: action as PrimitiveObject,
					});
					return { success: false };
				}
				case "pass": {
					work.info("Succeeded");
					return { success: true };
				}
			}
			previousExecutionId = workExecutionId;
			previousWorkId = workItem.workId;

			execution.debug("Dequeueing work item");

			workItem = workQueue.dequeue();
		}

		return { success: true };
	}
}
