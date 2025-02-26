import type { Context } from "aws-lambda";
export type HandlerEvent = unknown;
export type HandlerContext = unknown | Context;
export type ParsedHandlerContext =
	| {
			$kind: "VoidHandlerContext";
	  }
	| {
			$kind: "AwsLambdaHandlerContext";
			aws: Context;
	  };

export * from "./config/HandlerConfig.mjs";
export * from "./config/HandlerConfigAws.mjs";
export * from "./refs/HandlerContextRef.mjs";
export * from "./refs/HandlerEventRef.mjs";
