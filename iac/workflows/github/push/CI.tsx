/** @jsxImportSource @levicape/fourtwo */
/** @jsxRuntime automatic */

import {
	GithubJobBuilder,
	GithubWorkflowExpressions,
} from "@levicape/fourtwo/ci/cd/pipeline/github";
import {
	GithubJobX,
	GithubStepCheckoutX,
	GithubStepX,
	GithubWorkflowX,
} from "@levicape/fourtwo/x/github";
import {
	GithubStepNodeInstallX,
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
		name="on Push: Compile, Lint, Test all workspace packages"
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
			name="Compile, Lint and Test all workspace packages"
			runsOn={GithubJobBuilder.defaultRunsOn()}
			steps={
				<>
					<GithubStepCheckoutX />
					<GithubStepNodeSetupX
						configuration={NodeGhaConfiguration({ env })}
						children={(node) => {
							return (
								<>
									<GithubStepNodeInstallX {...node} />
									<GithubStepX
										name="Compile"
										run={[
											"pnpm exec nx run-many -t build --parallel=1 --verbose --no-cloud",
										]}
									/>
									<GithubStepX
										name="Lint"
										run={[
											"pnpm exec nx run-many -t lint --parallel=1 --verbose --no-cloud",
										]}
									/>
									<GithubStepX
										name="Test"
										run={[
											"pnpm exec nx run-many -t test --parallel=1 --verbose --no-cloud",
										]}
									/>
									<GithubStepX
										name="Clean cache"
										run={[
											"pnpm store prune || true",
											"corepack cache clean || true",
										]}
									/>
								</>
							);
						}}
					/>
				</>
			}
		/>
		<GithubJobX
			id="build-image"
			name="Build Docker Image"
			runsOn={GithubJobBuilder.defaultRunsOn()}
			steps={
				<>
					<GithubStepCheckoutX />
					<GithubStepNodeSetupX configuration={NodeGhaConfiguration({ env })}>
						{(node) => {
							return (
								<>
									<GithubStepNodeInstallX {...node} />
									<GithubStepX
										name="Build Docker Image"
										run={[
											"pnpm exec nx pack:build iac-images-application --verbose",
										]}
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
