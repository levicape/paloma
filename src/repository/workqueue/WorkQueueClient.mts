import Sqlite3 from "better-sqlite3";
import { destr } from "destr";
import { Context, Effect } from "effect";
import createQueryBuilder from "knex";
import type { TestAction } from "../../execution/TestAction.mjs";
import {
	LoggingContext,
	withStructuredLogging,
} from "../../server/loglayer/LoggingContext.mjs";
import { WorkQueueExecutionTable } from "./WorkQueueExecutionTable.mjs";
import { WorkQueueFilesystem } from "./WorkQueueFilesystem.mjs";

const { schema } = createQueryBuilder({
	client: "sqlite3",
	log: {
		warn: (...args) => {
			if (args[0].startsWith("Use async .hasTable")) {
				return;
			}
			console.warn(...args);
		},
		error: console.error,
		deprecate: console.warn,
		debug: console.log,
	},
	useNullAsDefault: true,
});

const { logsql, trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			return {
				logsql: logging.stream(
					(yield* logging.logger).withContext({
						event: "logsql",
					}),
					(logger, message) =>
						logger.metadataOnly({
							WorkQueueClient: {
								sql: message,
							},
						}),
				),
				trace: (yield* logging.logger).withContext({
					event: "trace",
				}),
			};
		}),
		Context.empty().pipe(withStructuredLogging({ prefix: "WorkQueueClient" })),
	),
);

const knex = createQueryBuilder<typeof WorkQueueClient.CREATE_WORK.table>({
	client: "sqlite3",
	useNullAsDefault: true,
});

export class WorkQueueRow {
	constructor(
		public workId: number,
		public stateFn: string,
		public prepared: string,
		public created: string,
		public result?: string,
		public action?: string,
		public processing?: string,
		public completed?: string,
		public credentials?: string,
	) {}
}

export class WorkQueueCountRow {
	constructor(public count: number) {}
}

export type Primitive = string | number | boolean;
export interface PrimitiveObject
	extends Partial<
		Record<
			string,
			PrimitiveObject | PrimitiveObject[] | Primitive | Primitive[]
		>
	> {}
export class WorkQueueClient {
	db: Sqlite3.Database;
	executionTable: WorkQueueExecutionTable;

	static CREATE_WORK = schema.createTableIfNotExists("work", (table) => {
		table.specificType("workId", "INTEGER PRIMARY KEY AUTOINCREMENT");
		table.text("prepared").notNullable().defaultTo("{}");
		table.text("stateFn").notNullable();
		table.text("created").defaultTo(knex.raw("CURRENT_TIMESTAMP"));
		table.text("action");
		table.text("result");
		table.text("processing");
		table.text("processId");
		table.text("completed");
	});

	constructor(
		private readonly props: {
			test: string;
			hash: string;
		},
	) {
		const { test, hash } = props;
		this.db = WorkQueueClient.database(test, hash);
		this.executionTable = new WorkQueueExecutionTable(this.db);
	}

	static database = (test: string, hash: string): Sqlite3.Database => {
		const fs = new WorkQueueFilesystem(test, hash);
		const db = new Sqlite3(fs.sqlite());
		const props = { test, hash };
		trace
			.withContext({
				Execution: {
					...props,
				},
			})
			.withMetadata({
				WorkQueueClient: {
					db: db.name,
				},
			})
			.debug("Creating database");
		db.exec(logsql(WorkQueueClient.CREATE_WORK.toQuery()));
		db.exec(logsql(WorkQueueExecutionTable.CREATE_WORK_EXECUTION.toQuery()));
		return db;
	};

	// No longer using .prepare, .query can cache the prepared statement for us
	// static prepare = (db: Database) => {
	// 	return {
	// 		countQueued: db.prepare(
	// 			knex("work")
	// 				.whereNull("processing")
	// 				.whereNull("completed")
	// 				.count()
	// 				.toQuery(),
	// 		),
	// 		countProcessing: db.prepare(
	// 			knex("work")
	// 				.whereNotNull("processing")
	// 				.whereNull("completed")
	// 				.count()
	// 				.toQuery(),
	// 		),
	// 		countStale: db.prepare(
	// 			knex("work")
	// 				.whereRaw("processing < datetime('now', '-1 hour')")
	// 				.whereNull("completed")
	// 				.count()
	// 				.toQuery(),
	// 		),
	// 		countQueuedTasksForWork: db.prepare(
	// 			knex("work_execution")
	// 				.where("workId", "?")
	// 				.andWhere("processing", "IS NULL")
	// 				.andWhere("completed", "IS NULL")
	// 				.count()
	// 				.toQuery(),
	// 		),
	// 		countProcessingTasksForWork: db.prepare(
	// 			knex("work_execution")
	// 				.where("workId", "?")
	// 				.andWhere("processing", "IS NOT NULL")
	// 				.andWhere("completed", "IS NULL")
	// 				.count()
	// 				.toQuery(),
	// 		),
	// 		countStaleTasksForWork: db.prepare(
	// 			knex("work_execution")
	// 				.where("workId", "?")
	// 				.andWhere("processing", "< datetime('now', '-1 hour')")
	// 				.andWhere("completed", "IS NULL")
	// 				.count()
	// 				.toQuery(),
	// 		),
	// 	};
	// };

	get({
		workId,
	}: {
		workId: number;
	}): WorkQueueRow | undefined {
		const row = this.db
			.prepare<[], WorkQueueRow>(
				logsql(knex("work").where({ workId }).toQuery()),
			)
			.get();

		if (row?.prepared) {
			row.prepared = destr(row.prepared);
		}
		return row;
	}

	enqueue({
		prepared,
		workId,
		stateFn,
		action,
	}: {
		prepared: PrimitiveObject;
		workId?: number;
		stateFn?: string;
		action?: TestAction<string>;
	}) {
		prepared = JSON.stringify(prepared) as unknown as PrimitiveObject;
		action = JSON.stringify(action) as unknown as TestAction<string>;
		if (workId) {
			this.db
				.prepare(
					logsql(
						knex("work")
							.where({ workId })
							.update({
								prepared,
								stateFn,
								action,
								processing: null,
								completed: null,
							})
							.toQuery(),
					),
				)
				.run();
			return;
		}

		return this.db
			.prepare(
				logsql(
					knex("work")
						.insert({ prepared, stateFn, action })
						.returning("workId")
						.toQuery(),
				),
			)
			.get();
	}

	dequeue(): WorkQueueRow | undefined {
		const result: WorkQueueRow | undefined = this.db
			.prepare<[], WorkQueueRow>(
				logsql(
					knex("work")
						.select("*")
						.whereNull("completed")
						.orderBy("processing", "asc", "first")
						.limit(1)
						.toQuery(),
				),
			)
			.get();

		if (!result) {
			return;
		}

		trace
			.withContext({
				workId: result.workId,
				action: result.action,
				stateFn: result.stateFn,
			})
			.withMetadata({
				WorkQueueClient: {
					row: result,
				},
			})
			.debug("Dequeueing work");

		if (result.action) {
			result.action = destr(result.action);
		}

		if (result.prepared) {
			result.prepared = destr(result.prepared);
		}

		this.db.exec(
			logsql(
				knex("work")
					.where({
						workId: result.workId,
					})
					.update({ processing: knex.raw("datetime()") })
					.toQuery(),
			),
		);

		return result;
	}

	complete({ workId, result }: { workId: number; result: PrimitiveObject }) {
		this.db.exec(
			logsql(
				knex<typeof WorkQueueClient.CREATE_WORK.table>("work")
					.where({ workId })
					.update({
						result: JSON.stringify(result),
						completed: knex.raw("datetime()"),
					})
					.toQuery(),
			),
		);
	}
}
