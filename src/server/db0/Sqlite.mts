import { createDatabase } from "db0";
import sqlite from "db0/connectors/better-sqlite3";
import { Context, Effect } from "effect";
import { RuntimeContext } from "../RuntimeContext.mjs";
import { LoggingContext } from "../loglayer/LoggingContext.mjs";
import { Db0Context } from "./DatabaseContext.mjs";

let { trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			return {
				trace: (yield* logging.logger).withPrefix("db0").withContext({
					$event: "sqlite",
				}),
			};
		}),
		RuntimeContext,
	),
);

export const withSqliteDb0 = (props: {
	sqlite: Parameters<typeof sqlite.default>[0];
}) =>
	Context.add(Db0Context, {
		database: Effect.scoped(
			Effect.acquireRelease(
				Effect.sync(() => {
					trace
						.withMetadata({
							sqlite: {
								props: props.sqlite,
							},
						})
						.debug("Acquiring sqlite database");
					return createDatabase(sqlite.default(props.sqlite));
				}),
				(db, _exit) => {
					return Effect.gen(function* () {
						const instance = yield* Effect.promise(() => db.getInstance());
						trace
							.withMetadata({
								sqlite: {
									props: props.sqlite,
								},
							})
							.debug("Releasing sqlite database");
						instance?.close();
					});
				},
			),
		),
	});
