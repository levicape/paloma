import { ok } from "node:assert";
import { Alltest } from "@levicape/paloma/runtime/execution/Alltest";
import type { ContinueAction } from "@levicape/paloma/runtime/execution/TestAction";

import KSUID from "ksuid";

const waitForMs = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

// Connect to server at $PALOMA_CANARY_SERVER
// Retry every 2s for 25s
// Server should return 200 OK, then not found

const test = new Alltest(
	{
		prepare: async () => {
			return {
				userId: KSUID.randomSync().string,
				now: new Date().toISOString(),
			};
		},
		resolve: async ({ prepared }) => {
			const { userId } = prepared;
			return {
				userId,
			};
		},
	},
	{
		start: {
			test: async ({ actions, prepared, resolved, clients }) => {
				clients.log.debug({
					Start: {
						message: "Check if server is running",
						prepared,
					},
				});
				const preparedtime = new Date(prepared.now);
				const limit = new Date(preparedtime.getTime() + 10000);
				if (new Date() > limit) {
					return actions.pass({
						result: {},
					});
				}
				await waitForMs(1200);
				try {
					const response = await fetch("http://localhost:9222");
					if (!response.ok) {
						if (new Date() > limit) {
							return actions.fail({
								message: `Server did not start ${JSON.stringify(response)}`,
							});
						}
						await waitForMs(2000);
						return actions.retry({
							to: "start",
						});
					}
				} catch (error) {
					await waitForMs(2000);
					return actions.retry({
						to: "start",
					});
				}

				ok(prepared.userId);
				ok(resolved.userId === prepared.userId);
				return actions.continue({
					to: "wait-for-shutdown",
					data: {},
				});
			},
		},
		"wait-for-shutdown": {
			test: async ({ clients, actions, prepared, previous }) => {
				clients.log.debug({
					Start: {
						message: "Check if server has stopped running",
						prepared,
					},
				});
				const preparedtime = new Date(prepared.now);
				const limit = new Date(preparedtime.getTime() + 35000);
				if (new Date() > limit) {
					return actions.pass({
						result: {},
					});
				}
				try {
					const response = await fetch("http://localhost:9222");
					if (response.ok) {
						if (new Date() > limit) {
							return actions.fail({
								message: `Server is still running ${JSON.stringify(response)}`,
							});
						}

						await waitForMs(3000);
						return actions.retry({
							to: "wait-for-shutdown",
						});
					}
				} catch (error) {
					let networkerr = error as {
						code?: string;
					};
					if (networkerr?.code === "ECONNREFUSED") {
						return actions.pass({
							result: {},
						});
					}
				}

				return actions.pass({
					result: {},
				});
			},
			async cleanup(opts) {},
		},
	},
	{
		name: import.meta.url.replace(/[^a-zA-Z0-9_]/g, "_"),
		entry() {
			return "start";
		},
	},
);

export const LambdaHandler = test.handler;
