import { ok } from "node:assert";
import KSUID from "ksuid";
import { SecretValue } from "../module/classified/index.js";
import type { ContinueAction } from "../module/harness/index.js";
import { Alltest } from "../module/harness/index.js";

const staticKey = crypto.subtle
	.generateKey("Ed25519", true, ["sign", "verify"])
	.then((key) => {
		console.log(key);
	});

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
				sessionId: new SecretValue(`token for ${userId}`),
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

test.handler({}, {});
