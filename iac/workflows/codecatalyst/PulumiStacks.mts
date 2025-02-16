export const CODECATALYST_PULUMI_STACKS: Array<{
	stack: string;
	output: string;
	name?: string;
}> = [
	{
		stack: "codestar",
	},
	{
		stack: "datalayer",
	},
	{
		stack: "monitor",
	},
	{
		stack: "domains/nevada/http",
		name: "nevada-http",
	},
	{
		stack: "domains/nevada/web",
		name: "nevada-web",
	},
	{
		stack: "domains/nevada/monitor",
		name: "nevada-monitor",
	},
].map((stack) => ({ ...stack, output: stack.stack.replaceAll("/", "_") }));
