// import type { createDatabase } from "db0";
// import type sqliteConnector from "db0/connectors/better-sqlite3";
// import { Context, type Effect } from "effect";
// import { env } from "std-env";

// export type LoggingContextProps = {
// 	readonly prefix?: string;
// };

// export class LoggingContext extends Context.Tag("LoggingContext")<
// 	LoggingContext,
// 	{
// 		readonly logger: Effect.Effect<ReturnType<typeof createDatabase<ReturnType<sqliteConnector>>>, unknown>;
// ReturnType<	}
// >()> {}

// export const withStructuredLogging = (props: {
// 	prefix?: string;
// 	context?: Record<string, unknown>;
// }) => {
// 	if (
// 		env.AWS_LAMBDA_FUNCTION_NAME ||
// 		env.STRUCTURED_LOGGING === "awspowertools"
// 	) {
// 		return withAwsPowertoolsLogger(props);
// 	}

// 	return withConsolaLogger(props);
// };
