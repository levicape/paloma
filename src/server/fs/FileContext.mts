import type { WriteStream } from "node:fs";
import { Context } from "effect";
import type { Effect } from "effect/Effect";

export class FileContext extends Context.Tag("FileContext")<
	FileContext,
	{
		$kind: "WriteStream";
		writeStream: Effect<WriteStream>;
	}
>() {}
