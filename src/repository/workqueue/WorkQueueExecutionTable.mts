import type { Database } from "better-sqlite3";
import createQueryBuilder from "knex";
import KSUID from "ksuid";
import { DebugLog } from "../../debug/DebugLog.mjs";
import type { PrimitiveObject, WorkQueueRow } from "./WorkQueueClient.mjs";

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

const l = DebugLog("REPOSITORY", (message) => ({
	WorkQueueExecutionTable: {
		repository: message,
	},
}));

const t = DebugLog("REPOSITORY", (message) => ({
	WorkQueueExecutionTable: {
		trace: message,
	},
}));
const knex = createQueryBuilder<
	typeof WorkQueueExecutionTable.CREATE_WORK_EXECUTION.table
>({
	client: "sqlite3",
	useNullAsDefault: true,
});

export type ExecutionId = string;

export interface WorkQueueExecution {
	workId: number;
	workExecutionId: ExecutionId;
	stateFn: string;
	created?: string;
	previousExecutionId?: ExecutionId;
	action?: string;
	meta?: string;
	processing?: string;
	completed?: string;
	resolved?: string;
}

export class WorkQueueExecutionRow implements WorkQueueExecution {
	constructor(
		public workId: number,
		public workExecutionId: ExecutionId,
		public stateFn: string,
		public created?: string,
		public previousExecutionId?: ExecutionId,
		public action?: string,
		public meta?: string,
		public processing?: string,
		public completed?: string,
		public resolved?: string,
	) {}
}

export class WorkQueueExecutionTable {
	constructor(private readonly db: Database) {}
	static CREATE_WORK_EXECUTION = schema.createTableIfNotExists(
		"work_execution",
		(table) => {
			table.integer("workId").notNullable();
			table.specificType("workExecutionId", "TEXT PRIMARY KEY");
			table.text("previousExecutionId");
			table.text("stateFn").notNullable();
			table.text("created").defaultTo(knex.raw("CURRENT_TIMESTAMP"));
			table.text("action");
			table.text("resolved");
			table.text("meta");
			table.text("processing");
			table.text("completed");
		},
	);

	async upsert(
		row: WorkQueueRow,
		{
			created,
			processing,
			result,
			completed,
			previousExecutionId,
			workExecutionId,
			resolved,
			meta,
		}: {
			created?: string;
			processing?: string;
			result?: PrimitiveObject;
			completed?: string;
			workExecutionId?: ExecutionId;
			previousExecutionId?: ExecutionId;
			resolved?: PrimitiveObject;
			meta?: PrimitiveObject;
		},
	): Promise<WorkQueueExecutionRow> {
		const { workId, stateFn } = row;
		const executionRow = new WorkQueueExecutionRow(
			workId,
			workExecutionId ?? KSUID.randomSync().string,
			stateFn,
			created,
			previousExecutionId,
			JSON.stringify(result),
			meta ? JSON.stringify(meta) : undefined,
			processing,
			completed,
			JSON.stringify(resolved),
		);

		t("ExecutionRow", executionRow, "TRACE");
		if (workExecutionId === undefined) {
			this.db.exec(l(knex("work_execution").insert(executionRow).toString()));
		} else {
			this.db.exec(
				l(
					knex("work_execution")
						.where({ workId, workExecutionId })
						.update(executionRow)
						.toString(),
				),
			);
		}

		return executionRow;
	}
}
