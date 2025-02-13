import { createWriteStream, statSync } from "node:fs";
import { Writable, pipeline } from "node:stream";
import { Context, Effect, Scope } from "effect";
import { ensureFileSync } from "fs-extra/esm";
import { deserializeError, serializeError } from "serialize-error";
import VError from "verror";
import { RuntimeContext } from "../RuntimeContext.mjs";
import { LoggingContext } from "../loglayer/LoggingContext.mjs";
import { FileContext, type FileContextStats } from "./FileContext.mjs";
import { WriteStreamHeaderlessCsv } from "./csv/WriteStreamCsv.mjs";

let { trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			return {
				trace: (yield* logging.logger).withPrefix("fs").withContext({
					$event: "write-stream",
				}),
			};
		}),
		RuntimeContext,
	),
);

export type WithWriteStreamAdapter = {
	fileExtension: string;
	transform: () => TransformStream;
};

export type WithWriteStreamProps = {
	name: Parameters<typeof createWriteStream>[0];
	scope: Scope.Scope;
	adapter?: WithWriteStreamAdapter;
} & {
	writeStream?: Exclude<
		Parameters<typeof createWriteStream>[1],
		BufferEncoding
	>;
};

export const withWriteStream = (props: WithWriteStreamProps) => {
	const tracestream = trace.child().withContext({
		$event: "write-stream-file",
		$WriteStream: {
			name: props.name,
		},
	});
	tracestream.debug("Creating uf8 stream FileContext");

	return Context.add(FileContext, {
		$kind: "WriteStream",
		file: Effect.acquireRelease(
			Effect.sync(() => {
				tracestream
					.withMetadata({
						WriteStream: {
							props: props.writeStream,
						},
					})
					.debug("Acquiring write stream");

				try {
					const adapter = props.adapter ?? WriteStreamHeaderlessCsv;
					const filepath = `${props.name}${adapter.fileExtension ?? ""}`;
					ensureFileSync(filepath as string);

					let stats: FileContextStats;
					try {
						stats = {
							$kind: "stats",
							stats: statSync(filepath),
						};
					} catch (error) {
						stats = {
							$kind: "error",
							error: deserializeError(error),
						};
					}
					const objectstream = adapter.transform();
					const filestream = Writable.toWeb(
						createWriteStream(filepath, {
							flags: "a",
							mode: 0x0770,
							encoding: "utf8",
							autoClose: true,
							emitClose: true,
							...(props.writeStream ?? {}),
						}),
					);
					tracestream.debug("Created write streams");

					objectstream.readable.pipeTo(filestream, { preventClose: true });
					tracestream.debug("Piped transform stream to write stream");

					return {
						path: filepath,
						stream: objectstream.writable,
						stats,
					};
				} catch (e: unknown) {
					const serialized = serializeError(e);
					tracestream
						.withMetadata({
							WriteStream: {
								error: serialized,
							},
						})
						.error("Error creating write stream");
					throw new VError(
						deserializeError(serialized),
						"Error creating write stream",
					);
				}
			}),
			({ stream }, exit) => {
				return Effect.gen(function* () {
					let error: unknown | undefined;
					try {
						stream?.close();
					} catch (e: unknown) {
						error = e;
					}

					let log = tracestream.withMetadata({
						WriteStream: {
							exit,
							error: error ? serializeError(error) : undefined,
						},
					});

					if (error === undefined) {
						log.debug("Released write stream");
					} else {
						log.error("Error releasing write stream");
					}
				});
			},
		).pipe(Scope.extend(props.scope)),
	});
};
