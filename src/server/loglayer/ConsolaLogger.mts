import { randomBytes } from "node:crypto";
import { ConsolaTransport } from "@loglayer/transport-consola";
import { createConsola } from "consola";
import { Context, Effect } from "effect";
import { LogLayer } from "loglayer";
import { serializeError } from "serialize-error";
import { env } from "std-env";
import { LoggingContext, LogstreamPassthrough } from "./LoggingContext.mjs";
import { $$spanId, $$traceId, LoggingPlugins } from "./LoggingPlugins.mjs";

const rootloglayer = Effect.succeed(
	new LogLayer({
		transport: new ConsolaTransport({
			logger: createConsola({
				formatOptions: {
					compact: false,
				},
				level: Number(env.LOG_LEVEL ?? "3"),
			}),
		}),
		errorSerializer: serializeError,
		plugins: LoggingPlugins,
	}).withContext({
		rootId: $$traceId(),
	}),
);

export const withConsolaLogger = (props: {
	prefix: string;
	context?: Record<string, unknown>;
}) =>
	Context.add(LoggingContext, {
		props,
		logger: Effect.gen(function* () {
			const logger = yield* yield* Effect.cached(rootloglayer);
			const loggerId = $$spanId();
			let child = props.prefix
				? logger.withPrefix(props.prefix)
				: logger.child();
			const loglayer = child.withContext({
				...props.context,
				loggerId,
			});

			loglayer
				.withMetadata({
					$span: "logger",
				})
				.debug(`logger span`);

			return loglayer;
		}),
		stream: LogstreamPassthrough,
	});
