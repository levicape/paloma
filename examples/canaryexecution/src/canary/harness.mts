import { ok } from "node:assert";
import { Alltest } from "@levicape/paloma/runtime/execution/Alltest";
import type { ContinueAction } from "@levicape/paloma/runtime/execution/TestAction";
import KSUID from "ksuid";

const test = new Alltest(
	{
		prepare: async () => {
			return {
				userId: KSUID.randomSync().string,
			};
		},
		resolve: async ({ prepared }) => {
			const { userId } = prepared;
			return {
				userId,
				sessionId: { value: "yeah" },
			};
		},
	},
	{
		start: {
			test: async ({ actions, prepared, resolved, clients }) => {
				clients.log.debug({
					Start: {
						message: "Starting test",
						prepared,
						resolved,
					},
				});
				ok(prepared.userId);
				ok(resolved.userId === prepared.userId);
				const { userId } = prepared;
				const sessionId = resolved ? resolved?.sessionId.value : {};
				const recordId = KSUID.randomSync().string;
				return actions.continue({
					to: "find-old-record",
					funnel: "system",
					data: {
						userId,
						sessionId,
						recordId,
					},
				});
			},
			async cleanup({ prepared, resolved }) {
				ok(prepared.userId);
				ok(resolved.userId === prepared.userId);
			},
		},
		"find-old-record": {
			test: async ({ clients, actions, previous, resolved }) => {
				clients.log.debug({
					FindOldRecord: {
						previous,
						resolved,
					},
				});
				ok(previous?.kind === "continue");
				ok((previous as ContinueAction)?.data?.userId === resolved.userId);
				ok(
					((previous as ContinueAction)?.data?.sessionId as string) ===
						resolved.sessionId.value,
				);
				ok((previous as ContinueAction)?.data?.recordId);

				return actions.continue({
					to: "update-record",
					funnel: "system",
				});
			},
			async cleanup(opts) {},
		},
		"update-record": {
			test: async ({ actions }) => {
				return actions.continue({
					to: "expect-no-update",
					funnel: "system",
				});
			},
		},
		"expect-no-update": {
			test: async ({ actions }) => {
				return actions.pass({
					result: { message: "No update occurred." },
					metric: "updates",
				});
			},
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
