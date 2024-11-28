// ../clients/aws/CloudFormation.ts
// ../clients/aws/S3.ts
// ../clients/pulumi/Pulumi.ts
// ../clients/aws/Cloudwatch.ts
import { Console as NodeConsole } from "node:console";

export class Console {
	static compact = () => {
		// biome-ignore lint/suspicious/noGlobalAssign:
		console = new NodeConsole({
			stdout: process.stdout,
			stderr: process.stderr,
			// ignoreErrors, colorMode, groupIndentation
			colorMode: "auto",
			inspectOptions: {
				// ...
				breakLength: Number.POSITIVE_INFINITY,
				compact: true,
				// ...
			},
		});
		globalThis.console = console;
	};
}
// TODO: Pino for logs, Winston for data
