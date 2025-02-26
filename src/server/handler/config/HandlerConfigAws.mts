import { Config } from "effect";

export type AWS_LAMBDA_FUNCTION_NAME = string | undefined;
export type HandlerConfigAwsArgs = [AWS_LAMBDA_FUNCTION_NAME];
/**
 * Configuration for AWS handler.
 */
export class HandlerConfigAws {
	static fromConfig = (args: HandlerConfigAwsArgs): HandlerConfigAws => {
		return new HandlerConfigAws(args[0]);
	};

	constructor(
		/**
		 * Lambda handler name. Configured by AWS Lambda environment automatically. If it is set, Paloma will use the `@types/aws-lambda` types for the handler event and context.
		 * @defaultValue undefined
		 * @see https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html
		 * @types aws-lambda
		 */
		readonly AWS_LAMBDA_FUNCTION_NAME: string | undefined,
	) {}
}

/**
 * Effectjs AWS handler configuration.
 */
export const HandlerConfigAwsMain = Config.all([
	Config.string("AWS_LAMBDA_FUNCTION_NAME").pipe(
		Config.withDefault(""),
		Config.withDescription(
			"Lambda handler name. Configured by AWS Lambda environment automatically. If it is set, Paloma will use the `@types/aws-lambda` types for the handler event and context.",
		),
	),
] as const);
