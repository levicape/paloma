export const SUSPENSE_GUARD = "<SUSPENSE_GUARD>";

export const AwaitClient = async () => {
	if (typeof window === "undefined") {
		await new Promise(() => void 0);
	}
};

export const SuspenseGuard = <T,>(a: T) => {
	if (typeof window === "undefined") {
		throw SUSPENSE_GUARD;
	}

	return a;
};
