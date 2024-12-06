import { equal } from "node:assert";
import { describe, it } from "node:test";
import { WorkQueueFilesystem } from "./WorkQueueFilesystem.mjs";

describe("WorkQueueFileSystem", async () => {
	it("sqlite filepath", async () => {
		const wq = new WorkQueueFilesystem("test", "hash");
		equal(wq.sqlite(), "/tmp/paloma/work/test_hash.sqlite");
		await WorkQueueFilesystem.ready();
	});
});
