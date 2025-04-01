/**
 * Configures the location, project name and stack name of the Pulumi stacks
 */
export const CODECATALYST_PULUMI_STACKS: Array<{
	/**
	 * Path to stack from "iac/stacks" directory
	 */
	stack: string;
	/**
	 * Name of the stack for use in pulumi
	 */
	name?: string;
	/**
	 * Whether this stack should only be deployed if APPLICATION_IMAGE_NAME matches APPLICATION_STACKREF_ROOT
	 */
	root?: boolean;
	/**
	 * The name of the stack for use in output shell exports. Automatically derived from the stack name if not provided
	 */
	output: string;
}> = (
	[
		{
			stack: "application",
			root: true,
		},
		{
			stack: "codestar",
			root: true,
		},
		{
			stack: "datalayer",
			root: true,
		},
		{
			stack: "dns/root",
			name: "dns-root",
			root: true,
		},
		{
			stack: "idp/oidc",
			name: "idp-oidc",
			root: true,
		},
		{
			stack: "idp/users",
			name: "idp-users",
			root: true,
		},
		{
			stack: "levicape/nevada/channels",
			name: "nevada-channels",
		},
		{
			stack: "levicape/nevada/client",
			name: "nevada-client",
		},
		{
			stack: "monitor",
			root: true,
		},
		{
			stack: "levicape/nevada/http",
			name: "nevada-http",
		},
		{
			stack: "levicape/nevada/web",
			name: "nevada-web",
		},
		{
			stack: "levicape/nevada/monitor",
			name: "nevada-monitor",
		},
		{
			stack: "levicape/nevada/wwwroot",
			name: "nevada-wwwroot",
		},
	] as const
).map((stack) => ({ ...stack, output: stack.stack.replaceAll("/", "_") }));
