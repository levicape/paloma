import { Context, Effect, Layer } from "effect";
import { gen } from "effect/Effect";
import VError from "verror";
import { InternalContext } from "../../server/ServerContext.mjs";
import { FileContext } from "../../server/fs/FileContext.mjs";
import { LoggingContext } from "../../server/loglayer/LoggingContext.mjs";

let { trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const logging = yield* LoggingContext;
			const trace = (yield* logging.logger)
				.withPrefix("resourcelog")
				.withContext({
					event: "resourcelog-layer",
				});
			return {
				trace,
			};
		}),
		InternalContext,
	),
);

export class ResourceLog extends Context.Tag("ResourceLog")<
	ResourceLog,
	{
		write: (resource: unknown) => Promise<void>;
	}
>() {}

/**
 * A ResourceLogLayer encapsulates a FileContext and provides methods
 * that emit newline-delimited JSON objects to the file.
 * @requires FileContext
 * @implements ResourceLog
 */
export const ResourceLogLayer = Layer.effect(
	ResourceLog,
	Effect.provide(
		gen(function* () {
			const file = yield* (yield* FileContext).writeStream;
			let traceresource = trace.child().withContext({
				event: "resourcelog-write",
				file: file.path,
			});

			return {
				write: async (resource: unknown) => {
					return new Promise<void>((resolve, reject) => {
						const line = `${JSON.stringify(resource)}\n`;
						file.write(line, (err) => {
							if (err) {
								traceresource
									.withMetadata({
										ResourceLogLayer: {
											resource,
											line,
										},
									})
									.withError(err)
									.error("Failed to write to file");

								reject(new VError(err, "Failed to write to file"));
							} else {
								traceresource.debug("Wrote to file");
								resolve();
							}
						});
					});
				},
			};
		}),
		InternalContext,
	),
);
