import { mkdirSync } from "node:fs";
import { basename } from "node:path";

export class WorkQueueFilesystem {
	static root = process.env.LEAF_WORK_QUEUE_FS_PATH ?? "/tmp/paloma/work";
	static namecache = {};
	constructor(
		private readonly test: string,
		private readonly hash: string,
	) {}

	sqlite = (): string => {
		if (this.test in WorkQueueFilesystem.namecache) {
			throw new Error(
				`Test ${this.test} already registered, please use a unique test name`,
			);
		}
		if (this.test !== basename(this.test)) {
			throw new Error(`Test ${this.test} must be safe for use in a filename`);
		}

		return `${WorkQueueFilesystem.root}/${this.test}_${this.hash}.sqlite`;
	};

	static ready = async () => {
		try {
			mkdirSync(WorkQueueFilesystem.root, { recursive: true });
		} catch (e) {
			if ((e as { code: string })?.code !== "EEXIST") {
				throw e;
			}
		}
	};
}
