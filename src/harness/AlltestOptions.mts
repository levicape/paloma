import type { Console } from "../debug/Console.mjs";

export type AlltestOptions<S> = {
	name: string;
	entry: () => NonNullable<S>;
	maxConcurrent?: number;
	console?: Exclude<keyof typeof Console, "prototype">;
};
