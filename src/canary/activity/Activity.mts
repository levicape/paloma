import { Effect } from "effect";
import type { Tag } from "effect/Context";
import type { ActorIdentifiers } from "../../actor/Actor.mjs";
import { PalomaRepositoryConfig } from "../../repository/RepositoryConfig.mjs";
import type { ResourceLog } from "../../repository/resourcelog/ResourceLog.mjs";
import { RuntimeContext } from "../../server/RuntimeContext.mjs";
import { LoggingContext } from "../../server/loglayer/LoggingContext.mjs";

const { config, trace } = await Effect.runPromise(
	Effect.provide(
		Effect.gen(function* () {
			const config = yield* PalomaRepositoryConfig;
			const logging = yield* LoggingContext;
			const trace = (yield* logging.logger).withContext({
				$event: "activity-main",
			});

			return {
				config,
				trace,
			};
		}),
		RuntimeContext,
	),
);

export type ActivityIdentifiers = {
	hash: string;
};

export type ActivityTaskProps = {
	contextlog: Tag.Service<ResourceLog>;
};

export type ActivityProps = {
	actor: ActorIdentifiers;
};

// export const ActivityResourceLogPath = ({ actor }: { actor: ActorIdentifiers }) =>
// 	`${config.data_path}/!execution/${actor.name}/-resourcelog/actor`;

export abstract class Activity {
	public identifiers: ActivityIdentifiers = { hash: "" };
}
