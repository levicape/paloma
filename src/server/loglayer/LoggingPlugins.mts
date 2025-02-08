import { randomBytes } from "node:crypto";
import type { LogLayerPlugin } from "loglayer";

export const $$traceId = () => randomBytes(16).toString("hex");
export const $$spanId = () => randomBytes(8).toString("hex");

type Depth = number;
export const LoggingPlugins: Array<LogLayerPlugin> = [
	{
		id: "timestamp-plugin",
		onBeforeDataOut: ({ data }) => {
			if (data) {
				data.timestamp = Date.now();
			}
			return data;
		},
	},
	((): LogLayerPlugin => {
		const latestLeaf = new Map<string, [string, Depth]>();

		const load = (parentSpanId: string) => {
			const spanId = latestLeaf.get(parentSpanId);
			if (spanId !== undefined) {
				return spanId;
			}
			return [parentSpanId, 1] as [string, Depth];
		};

		const store = (parentSpanId: string, spanId: string, depth: number) => {
			latestLeaf.set(parentSpanId, [spanId, depth]);
		};

		/**
		 * Purge any span graphs deeper than depth
		 */
		const purge = (depth: Depth) => {
			for (const [parentSpanId, [_, d]] of latestLeaf) {
				if (d > depth) {
					latestLeaf.delete(parentSpanId);
				}
			}
		};

		return {
			id: "otel-plugin",
			onContextCalled(context, loglayer) {
				// Lift rootId and loggerId to the context as traceId and spanId
				const {
					rootId: existingRootId,
					loggerId: existingLoggerId,
					spanId: existingSpanId,
					parentSpanId: existingParentSpanId,
				} = loglayer.getContext() as {
					rootId?: string;
					loggerId?: string;
					spanId?: string;
					traceId?: string;
					parentSpanId?: string;
				};

				// Values added by withContext
				const { rootId, loggerId } = context as {
					rootId?: string;
					loggerId?: string;
					traceId?: string;
				};

				// rootId is only set once
				if (existingRootId === undefined) {
					if (rootId !== undefined) {
						context.rootId = rootId;
						return context;
					}
				}

				// loggerId is only set once
				if (existingLoggerId === undefined && loggerId !== undefined) {
					context.loggerId = existingLoggerId ?? loggerId;
					context.parentSpanId = loggerId;
					store(loggerId, loggerId, 0);
					return context;
				}

				if (existingParentSpanId !== undefined) {
					context.parentSpanId = existingSpanId ?? existingParentSpanId;
					context.spanId = $$spanId();
				}

				return context;
			},
			onBeforeDataOut: (() => {
				return ({ data }) => {
					if (data) {
						const { spanId, rootId, parentSpanId, traceId, loggerId, $span } =
							data as {
								$span?: "logger";
								rootId?: string;
								loggerId: string;
								traceId?: string;
								spanId?: string;
								parentSpanId?: string;
							};
						// Use rootId if traceId is not already set
						const tid = traceId || rootId;

						// Create a new spanId only when the parentSpanId is not the root logger
						let sid =
							parentSpanId !== loggerId ? $$spanId() : (spanId ?? $$spanId());

						// Parent span id
						let psid = parentSpanId;

						if (tid !== undefined) {
							data.traceId = tid;
						}
						data.spanId = sid;
						if (psid !== undefined) {
							const previous = load(psid);
							if (previous[0] !== psid) {
								data.previousSpanId = previous[0];
							}

							store(psid, sid, previous[1] + 1);
							data.parentSpanId = psid;
						}

						if ($span === "logger") {
							data.spanId = loggerId;
							data.parentSpanId = undefined;

							// biome-ignore lint:
							delete data.$span;
							// biome-ignore lint:
							delete data.parentSpanId;
							data.spanId = loggerId;
							store(loggerId, loggerId, 0);
						}
					}

					if (latestLeaf.size > 2 ** 16) {
						purge(1);
					}

					return data;
				};
			})(),
		};
	})(),
	{
		id: "duration-plugin",
		onBeforeDataOut: (() => {
			const rootTimestamp = Date.now();
			const spanTimestamps = new Map<string, number>();

			const store = (spanId: string, timestamp: number) => {
				spanTimestamps.set(spanId, timestamp);
			};

			const duration = (parentSpanId?: string) => {
				const start = parentSpanId
					? spanTimestamps.get(parentSpanId)
					: rootTimestamp;
				const end = Date.now();
				return end - (start ?? rootTimestamp);
			};

			/**
			 * Purge any spans older than ageInSeconds
			 * @param ageInSeconds
			 */
			const purge = (ageInSeconds: number) => {
				const now = Date.now();
				for (const [spanId, timestamp] of spanTimestamps) {
					if (now - timestamp > ageInSeconds * 1000) {
						spanTimestamps.delete(spanId);
					}
				}
			};

			return ({ data }) => {
				if (data) {
					const { spanId, previousSpanId, parentSpanId } = data as {
						parentSpanId?: string;
						previousSpanId?: string;
						spanId?: string;
					};
					if (spanId) {
						if (spanTimestamps.size > 2 ** 16) {
							purge(60);
						}
						store(spanId, data.timestamp ?? Date.now());
					}

					if (data.duration === undefined) {
						data.duration = duration(previousSpanId ?? parentSpanId);
					}

					if (previousSpanId) {
						store(previousSpanId, data.timestamp ?? Date.now());
					}
					if (parentSpanId) {
						store(parentSpanId, data.timestamp ?? Date.now());
					}

					// biome-ignore lint:
					delete data.previousSpanId;
				}
				return data;
			};
		})(),
	},
];
