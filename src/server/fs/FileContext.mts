import type { Stats, WriteStream } from "node:fs";
import { Context } from "effect";
import type { Effect } from "effect/Effect";

export type FileContextStats =
	| { $kind: "stats"; stats: Stats }
	| { $kind: "error"; error: Error };

export class FileContext extends Context.Tag("FileContext")<
	FileContext,
	{
		$kind: "WriteStream";
		file: Effect<{
			path: string;
			stats: FileContextStats;
			stream: WritableStream;
		}>;
	}
>() {}
