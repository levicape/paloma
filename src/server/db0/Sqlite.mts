import { createDatabase } from "db0";
import sqlite from "db0/connectors/better-sqlite3";
import { Context, Effect } from "effect";
import { Db0Context } from "./DatabaseContext.mjs";

const db = (opts: Parameters<typeof sqlite.default>[0]) =>
	Effect.succeed(createDatabase(sqlite.default(opts)));

export const withSqliteDb0 = (props: {
	sqlite: Parameters<typeof sqlite.default>[0];
}) =>
	Context.add(Db0Context, {
		database: db(props.sqlite),
	});
