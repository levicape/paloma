/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import {
	GithubJobBuilder,
	GithubNodePipelinePackageSteps,
} from "@levicape/fourtwo/ci/cd/pipeline/github";
import { GithubWorkflowExpressions } from "@levicape/fourtwo/ci/cd/pipeline/github";
import {
	GithubJobX,
	GithubStepCheckoutX,
	GithubStepX,
	GithubWorkflowX,
} from "@levicape/fourtwo/x/github";
import {
	GithubStepNodeInstallX,
	GithubStepNodeScriptsX,
	GithubStepNodeSetupX,
} from "@levicape/fourtwo/x/github/node";
import { NodeGhaConfiguration } from "../push/GithubMainPush.js";

const {
	current: { register, context: _$_, env },
} = GithubWorkflowExpressions;

// const enquirer = new Enquirer();
// const prompt = enquirer.prompt.bind(enquirer);

export default async () => (
	<GithubWorkflowX
		name="on Release: [released] Publish @levicape Github"
		on={{
			release: {
				types: ["released"],
			},
		}}
		env={{
			...register("NPM_REGISTRY_PROTOCOL", "https"),
			...register("NPM_REGISTRY_HOST", "npm.pkg.github.com"),
		}}
	>
		<GithubJobX
			id="packages"
			name="Compile package, test and publish to npm"
			runsOn={GithubJobBuilder.defaultRunsOn()}
			contents={"read"}
			packages={"write"}
			steps={
				<>
					<GithubStepX
						name={"Verify registry URL"}
						continueOnError={true}
						run={[
							`echo "NPM_REGISTRY_URL: ${env("NPM_REGISTRY_PROTOCOL")}://${env("NPM_REGISTRY_HOST")}"`,
							`curl -v --insecure ${env("NPM_REGISTRY_PROTOCOL")}://${env("NPM_REGISTRY_HOST")}`,
						]}
					/>
					<GithubStepCheckoutX />
					<GithubStepNodeSetupX configuration={NodeGhaConfiguration({ env })}>
						{(node) => {
							return (
								<>
									<GithubStepNodeInstallX {...node} />
									<GithubStepX
										name={"Compile module"}
										run={[
											new GithubNodePipelinePackageSteps()
												.getScript(node.configuration)("compile")
												.build().run as string,
										]}
									/>
									<GithubStepNodeScriptsX {...node} scripts={["lint"]} />
									<GithubStepNodeScriptsX {...node} scripts={["test"]} />
									<GithubStepX
										name={"Increment version"}
										run={[
											"export PREID=$RELEVANT_SHA",
											"export PREID=${PREID:0:10}",
											`export ARGS="--git-tag-version=false --commit-hooks=false"`,
											`npm version ${_$_("github.event.release.tag_name")}-$PREID.${_$_("github.run_number")} $ARGS --allow-same-version`,
										]}
										env={{
											RELEVANT_SHA: _$_(
												"github.event.release.target_commitish || github.sha",
											),
										}}
									/>
									<GithubStepNodeScriptsX {...node} scripts={["prepublish"]} />
									<GithubStepX
										if={"success()"}
										name={"Increment version"}
										continueOnError={true}
										run={["pnpm publish --no-git-checks;"]}
									/>
								</>
							);
						}}
					</GithubStepNodeSetupX>
				</>
			}
		/>
	</GithubWorkflowX>
);
