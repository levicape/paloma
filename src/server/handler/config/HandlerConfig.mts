import { Config } from "effect";
import { HandlerConfigAws, HandlerConfigAwsMain } from "./HandlerConfigAws.mjs";

/**
 * Configuration root for computing environment specific variables.
 */
export class HandlerConfig {
	constructor(readonly aws: HandlerConfigAws) {}
}

/**
 * Effectjs AWS handler configuration.
 */
export const HandlerConfigMain = Config.map(
	Config.all([HandlerConfigAwsMain] as const),
	([awsConfig]) => {
		return new HandlerConfig(HandlerConfigAws.fromConfig(awsConfig));
	},
);
