import { createDatabase } from "db0";
import sqlite from "db0/connectors/better-sqlite3";
import { Context, Effect } from "effect";
import { serializeError } from "serialize-error";
import { env } from "std-env";
import { ulid } from "ulidx";

// const db =
// const rootloglayer = Effect.succeed(
// createDatabase(
//   sqlite({
//     name: ":memory:",
//   }),
// )
// .mapError(serializeError)

// );

// static database = (test: string, hash: string): Sqlite3.Database => {
// 	const fs = new WorkQueueFilesystem(test, hash);
// 	const db = new Sqlite3(fs.sqlite());
// 	const props = { test, hash };
// 	db.exec(s(WorkQueueClient.CREATE_WORK.toQuery(), props));
// 	db.exec(s(WorkQueueExecutionTable.CREATE_WORK_EXECUTION.toQuery(), props));
// 	return db;
// };
// export type SqliteFile = string | ":memory:";
// export const withSqliteDatabase = (props: {
// 	name: string;
// }) =>
// 	Context.add(SqlContext, {
// 		props,
// 		logger: Effect.gen(function* () {
// 			const logger = yield* yield* Effect.cached(rootloglayer);
// 			const loggerId = ulid().slice(-16);
// 			let child = props.prefix
// 				? logger.withPrefix(props.prefix)
// 				: logger.child();
// 			return child.withContext({
// 				...props.context,
// 				loggerId,
// 			});
// 		}),
// 	});
