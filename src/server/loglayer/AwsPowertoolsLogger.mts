import { LogLevel, Logger } from "@aws-lambda-powertools/logger";
import { PowertoolsTransport } from "@loglayer/transport-aws-lambda-powertools";
import { Context, Effect } from "effect";
import { LogLayer } from "loglayer";
import { serializeError } from "serialize-error";
import { env } from "std-env";
import { LoggingContext, LogstreamPassthrough } from "./LoggingContext.mjs";
import { $$spanId, $$traceId, LoggingPlugins } from "./LoggingPlugins.mjs";

let logLevel: (typeof LogLevel)[keyof typeof LogLevel];
try {
	logLevel = Number(env.LOG_LEVEL ?? "3") >= 3 ? LogLevel.INFO : LogLevel.DEBUG;
} catch (e) {
	logLevel = "INFO";
}

const rootloglayer = Effect.succeed(
	new LogLayer({
		transport: new PowertoolsTransport({
			logger: new Logger({
				// TODO: Stack env vars, add to protocol stands
				serviceName: env.AWS_CLOUDMAP_SERVICE_NAME ?? env.PULUMI__NAME,
				logLevel,
			}),
		}),
		errorSerializer: serializeError,
		plugins: LoggingPlugins,
	}).withContext({
		rootId: $$traceId(),
	}),
);

export const withAwsPowertoolsLogger = (props: {
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
