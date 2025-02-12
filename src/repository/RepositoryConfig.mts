import { Config } from "effect";

/**
 * Configuration for the Paloma data structures.
 */
export class RepositoryConfig {
	/**
	 * The path to the root directory where the data is stored.
	 */
	constructor(readonly data_path: string | null) {}
}

/**
 * Effect-ts configuration for the Paloma data structures.
 */
export const PalomaRepositoryConfig = Config.map(
	Config.all([
		Config.nested(
			Config.all([
				Config.string("DATA_PATH").pipe(Config.withDefault("/tmp/paloma")),
			]),
			"PALOMA",
		),
	]),
	([[data_path]]) => new RepositoryConfig(data_path),
);
