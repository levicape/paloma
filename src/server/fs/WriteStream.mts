import { createWriteStream } from "node:fs";
import { Context, Effect, Scope } from "effect";
import { ensureFileSync } from "fs-extra/esm";
import { deserializeError, serializeError } from "serialize-error";
import VError from "verror";
import { InternalContext } from "../ServerContext.mjs";
import { LoggingContext } from "../index.mjs";
import { FileContext } from "./FileContext.mjs";

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
		InternalContext,
	),
);

export type WithWriteStreamProps = {
	name: Parameters<typeof createWriteStream>[0];
	scope: Scope.CloseableScope;
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
	tracestream.debug("Creating write stream");

	return Context.add(FileContext, {
		$kind: "WriteStream",
		writeStream: Effect.acquireRelease(
			Effect.sync(() => {
				tracestream
					.withMetadata({
						WriteStream: {
							props: props.writeStream,
						},
					})
					.debug("Acquiring write stream");

				try {
					ensureFileSync(props.name as string);

					return createWriteStream(props.name, {
						flags: "a",
						mode: 0x0666,
						encoding: "utf8",
						autoClose: true,
						emitClose: true,
						flush: true,
						...(props.writeStream ?? {}),
					});
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
			(writestream, exit) => {
				return Effect.gen(function* () {
					let error: unknown | undefined;
					try {
						writestream?.end();
						writestream?.close();
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
