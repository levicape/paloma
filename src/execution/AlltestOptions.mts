export type AlltestOptions<S> = {
	name: string;
	entry: () => NonNullable<S>;
	maxConcurrent?: number;
};
