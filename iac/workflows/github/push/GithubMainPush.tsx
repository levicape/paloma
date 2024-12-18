/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import {
	GithubJobBuilder,
	GithubWorkflowExpressions,
} from "@levicape/fourtwo/ci/cd/pipeline/github";
import {
	GithubJobX,
	GithubStepCheckoutX,
	GithubWorkflowX,
} from "@levicape/fourtwo/x/github";
import {
	GithubStepNodeInstallX,
	GithubStepNodeScriptsX,
	GithubStepNodeSetupX,
} from "@levicape/fourtwo/x/github/node";

const {
	current: { register, context: _$_, env },
} = GithubWorkflowExpressions;

export const NodeGhaConfiguration = ({
	env: e,
	secret,
	cache,
}: { env: typeof env; secret?: string; cache?: boolean }) =>
	({
		packageManager: {
			node: "pnpm",
			cache: !!(cache === undefined || cache === true),
		},
		registry: {
			scope: "@levicape",
			host: `${e("NPM_REGISTRY_PROTOCOL")}://${e("NPM_REGISTRY_HOST")}`,
			secret,
		},
		version: {
			node: "22.12.0",
		},
	}) as const;

export default async () => (
	<GithubWorkflowX
		name="on Push: CI"
		on={{
			push: {
				branches: ["main"],
			},
		}}
		env={{
			...register("NPM_REGISTRY_PROTOCOL", "https"),
			...register("NPM_REGISTRY_HOST", "npm.pkg.github.com"),
		}}
	>
		<GithubJobX
			id="build"
			name="Compile, Lint and Test package"
			runsOn={GithubJobBuilder.defaultRunsOn()}
			steps={
				<>
					<GithubStepCheckoutX />
					<GithubStepNodeSetupX configuration={NodeGhaConfiguration({ env })}>
						{(node) => {
							return (
								<>
									<GithubStepNodeInstallX {...node} />
									<GithubStepNodeScriptsX {...node} scripts={["compile"]} />
									<GithubStepNodeScriptsX {...node} scripts={["lint"]} />
									<GithubStepNodeScriptsX {...node} scripts={["test"]} />
								</>
							);
						}}
					</GithubStepNodeSetupX>
				</>
			}
		/>
	</GithubWorkflowX>
);

// TODO: Upload / Download artifacts between parent and children
