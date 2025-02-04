import { inspect } from "node:util";
import { StackReference, getStack } from "@pulumi/pulumi";
import { deserializeError, serializeError } from "serialize-error";
import { VError } from "verror";
import type { z } from "zod";

export const $stack$ = getStack().split(".").pop();

export const $ref = (stack: string) =>
	new StackReference(`organization/${stack}/${stack}.${$stack$}`);

export const $val = <Z extends z.AnyZodObject | z.ZodRecord>(
	json: string,
	schema: Z,
	opts?: {
		info?: Record<string, unknown>;
	},
): z.infer<Z> => {
	try {
		if (typeof json !== "string") {
			return schema.parse(json);
		}

		return schema.parse(JSON.parse(json));
	} catch (e: unknown) {
		throw new VError(
			{
				name: "StackrefValueParseError",
				cause: e instanceof Error ? deserializeError(e) : undefined,
				message: `Failed to parse value`,
				info: {
					error: serializeError(e),
					json,
					schema,
					...(opts?.info ?? {}),
				},
			},
			`Failed to parse '${opts?.info?.["outputName"] ?? "<OUTPUT_NAME>"}' value`,
		);
	}
};

export type DereferenceConfig = Record<
	string,
	Record<string, { refs: Record<string, z.AnyZodObject | z.ZodRecord> }>
>;

export type DereferencedOutput<T extends DereferenceConfig> = {
	[R in keyof T]: {
		[S in keyof T[R]]: {
			[K in keyof T[R][S]["refs"]]: z.infer<T[R][S]["refs"][K]>;
		};
	};
};

export const $deref = async <T extends DereferenceConfig>(
	config: T,
): Promise<DereferencedOutput<T>[string]> => {
	const dereferencedRoots = {} as DereferencedOutput<T>;

	if (Object.keys(config).length > 1) {
		throw new VError("Only one root key is allowed");
	}
	inspect(
		{
			$stack$,
		},
		{ depth: null },
	);

	for (const rootKey in config) {
		const rootStacks = config[rootKey];
		const dereferencedStacks = {} as Record<string, Record<string, unknown>>;

		for (const stackName in rootStacks) {
			const stackConfig = rootStacks[stackName];
			const outputValues = {} as Record<string, unknown>;

			const ref = $ref(`${rootKey}-${stackName}`);
			for (const stackOutput in stackConfig.refs) {
				const schema = stackConfig.refs[stackOutput];
				const envStackName = stackName.replace(/-/g, "_");
				const outputName = `${rootKey}_${envStackName}_${stackOutput}`;
				const output = await ref.getOutputDetails(outputName);
				outputValues[stackOutput] = $val(output.value, schema, {
					info: {
						rootKey,
						stackName,
						envStackName,
						stackOutput,
						outputName,
					},
				});

				inspect(
					{
						rootKey,
						stackName,
						envStackName,
						stackOutput,
						outputName,
					},
					{ depth: null },
				);
			}

			dereferencedStacks[stackName] = outputValues;
		}

		dereferencedRoots[rootKey] =
			dereferencedStacks as DereferencedOutput<T>[typeof rootKey];
	}

	return Object.values(dereferencedRoots)[0];
};
