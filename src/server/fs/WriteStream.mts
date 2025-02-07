import { createWriteStream } from "node:fs";
import { Context, Effect } from "effect";
import { InternalContext } from "../ServerContext.mjs";
import { LoggingContext } from "../index.mjs";
import { FileContext } from "./FileContext.mjs";

let { trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			return {
				trace: (yield* logging.logger).withPrefix("fs").withContext({
					event: "write-stream",
				}),
			};
		}),
		InternalContext,
	),
);

export type WithWriteStreamProps = {
	name: Parameters<typeof createWriteStream>[0];
} & {
	writeStream: Exclude<Parameters<typeof createWriteStream>[1], BufferEncoding>;
};

export const withWriteStream = (props: WithWriteStreamProps) =>
	Context.add(FileContext, {
		$kind: "WriteStream",
		writeStream: Effect.scoped(
			Effect.acquireRelease(
				Effect.sync(() => {
					trace
						.withMetadata({
							WriteStream: {
								name: props.name,
							},
						})
						.debug("Acquiring write stream");
					return createWriteStream(props.name, {
						flags: "a",
						encoding: "utf8",
						mode: 0x0666,
						...props.writeStream,
					});
				}),
				(writestream, _exit) => {
					return Effect.gen(function* () {
						trace
							.withMetadata({
								WriteStream: {
									name: props.name,
								},
							})
							.debug("Releasing write stream");
						writestream?.close();
					});
				},
			),
		),
	});
