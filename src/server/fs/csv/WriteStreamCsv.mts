import { stringify } from "csv/sync";
import type { WithWriteStreamAdapter } from "../WriteStream.mjs";

export const WriteStreamCsvLineDelimiter = "⸮";
export const WriteStreamCsvLine = (row: unknown) =>
	stringify([row], {
		defaultEncoding: "utf8",
		delimiter: WriteStreamCsvLineDelimiter,
		header: false,
		cast: {
			date: (value) => value.toISOString(),
		},
	});
export const WriteStreamHeaderlessCsv: WithWriteStreamAdapter = {
	fileExtension: ".csv",
	transform: () =>
		new TransformStream<unknown, string>({
			async transform(chunk, controller) {
				const text = WriteStreamCsvLine(chunk);
				controller.enqueue(text);
			},
		}),
};
