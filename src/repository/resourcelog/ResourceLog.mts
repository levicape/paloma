import { EOL } from "node:os";
import { Stream, Writable } from "node:stream";
import { stringify } from "csv/sync";
import { Context, Effect, Layer, Scope } from "effect";
import { gen } from "effect/Effect";
import { deserializeError } from "serialize-error";
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
 * - released: the timestamp when the resource was released
 * - resource: the resource that was released
 *
 * @see ResourceLogFile
 * @see ResourceLogTimestamp
 * @see ResourceLogLineContext
 */
export type ResourceLogLine = [
	ResourceLogTimestamp, // acquired
	ResourceLogTimestamp, // released
	ResourceLogLineResource,
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
			name: string,
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
				)).file.pipe(Scope.extend(scope));

				let traceresource = trace.child().withContext({
					$event: "resourcelog-layer",
					$ResourceLogLayer: {
						file: file.path,
					},
				});
				traceresource.debug("ResourceLogLayer created");

				return {
					scope,
					capture: (name: string, props: ResourceLogCaptureFn) => {
						let row: ResourceLogLine = Array(3) as ResourceLogLine;
						const tracecapture = traceresource.child();
						tracecapture
							.withContext({
								$event: "resourcelog-capture",
								$ResourceLog: {},
							})
							.debug("Capturing resource");

						return Effect.acquireRelease(
							Effect.gen(function* () {
								row[0] = new Date();

								tracecapture
									.withMetadata({
										ResourceLogFile: {
											acquired: {
												timestamp: row[0],
											},
										},
									})
									.debug("Acquired resource");

								return;
							}),
							() => {
								row[1] = new Date();
								row[2] = Object.assign({}, props());

								FILTERED_KEYS.forEach((key) => {
									delete row[2][key];
								});

								traceresource
									.withMetadata({
										ResourceLogFile: {
											released: {
												timestamp: row[1],
												resource: row[2],
											},
										},
									})
									.debug("Released resource");

								const captureFn = Effect.promise((_abortsignal) => {
									const readable = new ReadableStream({
										start(controller) {
											controller.enqueue(row);
											controller.close();
										},
									});

									return readable.pipeTo(file.stream, { preventClose: true });
								});

								return captureFn;
							},
						);
					},
				};
			}),
			InternalContext,
		),
	);
