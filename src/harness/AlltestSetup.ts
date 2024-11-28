export type AlltestSetup<Prepared, Resolved> = {
	prepare?: () => Promise<Prepared>;
	resolve?: (opts: {
		prepared: Prepared;
	}) => Promise<Resolved>;
	// credentials
};
