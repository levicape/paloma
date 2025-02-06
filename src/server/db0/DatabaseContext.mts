import type { Database } from "db0";
import type sqlite from "db0/connectors/better-sqlite3";
import { Context } from "effect";
import type { Effect } from "effect/Effect";
import { withSqliteDb0 } from "./Sqlite.mjs";

export class Db0Context extends Context.Tag("Db0Context")<
	Db0Context,
	{
		database: Effect<Database>;
	}
>() {}

export type Db0ContextProps = { sqlite: Parameters<typeof sqlite.default>[0] };

export const withDb0 = (props?: Db0ContextProps) => {
	return withSqliteDb0(props ?? { sqlite: { path: ":memory:" } });
};
