import { stringify } from "csv/sync";
import { Context, Effect, Layer, Scope } from "effect";
import { gen } from "effect/Effect";
import { deserializeError, serializeError } from "serialize-error";
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
					$event: "resourcelog-layer",
				});
			return {
				trace,
			};
		}),
		InternalContext,
	),
);

export type ResourceLogTimestamp = Date;
export type ResourceLogLineResource = Record<string, unknown>;
/**
 * A ResourceLogLine represents a single line in the resource log. It has the following fields:
 * - acquired: the timestamp when the resource was acquired
 * - acquiredResource: the resource that was acquired
 * - acquiredContext: the context data when the resource was acquired
 * - released: the timestamp when the resource was released
 * - releasedResource: the resource that was released
 * - releasedContext: the context data when the resource was released
 *
 * @see ResourceLogFile
 * @see ResourceLogTimestamp
 * @see ResourceLogLineContext
 */
export type ResourceLogLine = [
	ResourceLogTimestamp, // acquired
	ResourceLogLineResource, // acquiredResource
	ResourceLogTimestamp, // released
	ResourceLogLineResource, // releasedResource
];

/**
 * @see ResourceLog
 * This function will be called when a resource is acquired or released. The return value will be saved in the log.
 */
export type ResourceLogCaptureFn = () => ResourceLogLineResource;

/**
 * @see ResourceLog
 */
// biome-ignore lint/suspicious/noConfusingVoidType:
export type ResourceLogCaptureState = void;

/**
 * A ResourceLog is a Service that provides methods
 * for streaming rows of a captured context.
 *
 */
export class ResourceLog extends Context.Tag("ResourceLog")<
	ResourceLog,
	{
		scope: Scope.Scope;
		capture: (
			props: ResourceLogCaptureFn,
		) => Effect.Effect<ResourceLogCaptureState, unknown, Scope.Scope>;
	}
>() {}

const FILTERED_KEYS = ["rootId", "loggerId", "timestamp", "duration", "_depth"];

/**
 * ResourceLogFile encapsulates a FileContext and provides methods
 * that stream rows of the current logging context to a file.
 * @requires FileContext
 * @extends ResourceLog
 *
 */
export const ResourceLogFile = (scope: Scope.Scope) =>
	Layer.effect(
		ResourceLog,
		Effect.provide(
			gen(function* () {
				const file = yield* (yield* FileContext.pipe(
					Scope.extend(scope),
				)).writeStream.pipe(Scope.extend(scope));

				let traceresource = trace.child().withContext({
					$event: "resourcelog-layer",
					$ResourceLogLayer: {
						file: file.path,
					},
				});
				traceresource.debug("ResourceLogLayer created");

				return {
					scope,
					capture: (props: ResourceLogCaptureFn) => {
						let row: ResourceLogLine = Array(8) as ResourceLogLine;
						const tracecapture = traceresource.child();
						tracecapture
							.withContext({
								$event: "capture",
							})
							.debug("Capturing resource");

						return Effect.acquireRelease(
							Effect.gen(function* () {
								row[0] = new Date();
								row[1] = props();

								// biome-ignore lint:
								delete row[1]?.rootId;
								// biome-ignore lint:
								delete row[1]?.loggerId;
								// biome-ignore lint:
								delete row[1]?.timestamp;
								// biome-ignore lint:
								delete row[1]?.duration;

								tracecapture
									.withMetadata({
										ResourceLogFile: {
											acquired: {
												timestamp: row[0],
												resource: row[1],
											},
										},
									})
									.debug("Acquired resource");

								return;
							}),
							() => {
								row[2] = new Date();
								row[3] = props();

								// biome-ignore lint:
								delete row[3]?.rootId;
								// biome-ignore lint:
								delete row[3]?.loggerId;
								// biome-ignore lint:
								delete row[3]?.timestamp;
								// biome-ignore lint:
								delete row[3]?.duration;

								traceresource
									.withMetadata({
										ResourceLogFile: {
											released: {
												timestamp: row[2],
												resource: row[3],
											},
										},
									})
									.debug("Released resource");

								const line = stringify([row], {
									defaultEncoding: "utf8",
									delimiter: "⸰⸮⸟",
									header: false,
									cast: {
										date: (value) => value.toISOString(),
									},
								});
								const write = Effect.promise(
									(_abortsignal) =>
										new Promise((resolve, reject) => {
											file.write(line, (err) => {
												if (err) {
													traceresource
														.withMetadata({
															ResourceLogFile: {
																line,
															},
														})
														.withError(deserializeError(err))
														.error("Failed to write to file");

													reject(deserializeError(serializeError(err)));
												} else {
													traceresource.debug("Wrote to file");
													resolve(undefined);
												}
											});
										}),
								);

								return write;
							},
						);
					},
				};
			}),
			InternalContext,
		),
	);
