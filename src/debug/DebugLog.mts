export type DebugComponent =
	| "HARNESS"
	| "REPOSITORY"
	| "STATE"
	| "SQL"
	| "SECRET";
export type DebugLevel = "TRACE" | "INFO" | "WARN" | "ERROR";

export const DebugPriority = {
	TRACE: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3,
};

// TODO: Should parse a string from env (e.g. "LEAF_DEBUG_ENABLED=HARNESS,REPOSITORY,STATE,SQL,SECRET")
// This string should be parsed and converted into a static record of enabled flags
export const DebugEnabledFlags =
	(component: DebugComponent) => (level: DebugLevel) => {
		if (level === "ERROR") {
			return { enabled: true };
		}

		if (component === "HARNESS") {
			return { enabled: true };
		}

		if (component === "REPOSITORY") {
			if (level === "TRACE") {
				return { enabled: true };
			}
			return { enabled: true };
		}

		if (component === "STATE") {
			return { enabled: true };
		}

		if (component === "SQL") {
			return { enabled: true };
		}

		if (component === "SECRET") {
			return { enabled: false };
		}

		return { enabled: false };
	};

// TODO: Set this up in lambda handler, lambda will run fn handler directly, cli will start the server similar to spork
const isLambdaEnabled =
	process.env.LEAF_CONTEXT?.toLowerCase().includes("lambda");
export const DebugLog = (
	component: DebugComponent,
	template: (message: string) => Record<string, unknown>,
) => {
	const flags = DebugEnabledFlags(component);
	return (
		message: unknown,
		data?: unknown,
		level: DebugLevel = "TRACE",
	): string => {
		if (flags(level).enabled) {
			const templated = template(message as string);
			Object.assign(templated, {
				level,
				data,
				component,
			});

			if (isLambdaEnabled) {
				console.log(templated);
			} else {
				Object.assign(templated, {
					now: new Date().toISOString(),
				});
				console.dir(templated, { depth: null });
			}
		}

		return message as string;
	};
};
