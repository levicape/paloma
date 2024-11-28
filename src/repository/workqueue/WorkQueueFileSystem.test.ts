import { equal } from "node:assert";
import { describe, it } from "node:test";
import { WorkQueueFilesystem } from "./WorkQueueFilesystem.js";

describe("WorkQueueFileSystem", async () => {
	it("sqlite filepath", async () => {
		const wq = new WorkQueueFilesystem("test", "hash");
		equal(wq.sqlite(), "/tmp/papagallo/work/test_hash.sqlite");
		await WorkQueueFilesystem.ready();
	});
});
