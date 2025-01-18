import { Context } from "@levicape/fourtwo-pulumi";
import { Application } from "@pulumi/aws/codedeploy";
import { DeploymentConfig } from "@pulumi/aws/codedeploy/deploymentConfig";
import { DeploymentGroup } from "@pulumi/aws/codedeploy/deploymentGroup";
import { Repository as ECRRepository, LifecyclePolicy } from "@pulumi/aws/ecr";
import { getLifecyclePolicyDocument } from "@pulumi/aws/ecr/getLifecyclePolicyDocument";
import { RepositoryPolicy } from "@pulumi/aws/ecr/repositoryPolicy";
import { getRole } from "@pulumi/aws/iam/getRole";
import { all } from "@pulumi/pulumi/output";

export = async () => {
	const context = await Context.fromConfig();
	const _ = (name: string) => `${context.prefix}-${name}`;

	const farRole = await getRole({ name: "FourtwoAccessRole" });

	const ecr = await (async () => {
		const repository = new ECRRepository(_("binaries"));
		new LifecyclePolicy(_("binaries-lifecycle"), {
			repository: repository.name,
			policy: repository.repositoryUrl.apply(
				async () =>
					(
						await getLifecyclePolicyDocument({
							rules: [
								{
									priority: 1,
									description: "Expire images older than 14 days",
									selection: {
										tagStatus: "tagged",
										countType: "sinceImagePushed",
										countUnit: "days",
										countNumber: 14,
										tagPrefixLists: ["git"],
									},
									action: {
										type: "expire",
									},
								},
							],
						})
					).json,
			),
		});
		new RepositoryPolicy(_("binaries-policy"), {
			repository: repository.name,
			policy: repository.repositoryUrl.apply(() =>
				JSON.stringify({
					Version: "2008-10-17",
					Statement: [
						{
							Effect: "Allow",
							Principal: {
								Service: [
									"codebuild.amazonaws.com",
									"codedeploy.amazonaws.com",
									"codepipeline.amazonaws.com",
									"lambda.amazonaws.com",
								],
							},
							Action: [
								"ecr:GetDownloadUrlForLayer",
								"ecr:BatchGetImage",
								"ecr:BatchCheckLayerAvailability",
							],
						},
					],
				}),
			),
		});

		return {
			repository,
		};
	})();

	const codedeploy = await (async () => {
		const application = new Application(_("application"), {
			computePlatform: "Lambda",
		});

		const deploymentConfig = new DeploymentConfig(_("deployment-config"), {
			computePlatform: "Lambda",
			trafficRoutingConfig: context.environment.isProd
				? {
						type: "TimeBasedLinear",
						timeBasedLinear: {
							interval: 2,
							percentage: 12,
						},
					}
				: {
						type: "AllAtOnce",
					},
		});

		const deploymentGroup = new DeploymentGroup(_("deployment-group"), {
			appName: application.name,
			deploymentGroupName: _("deployment-group"),
			serviceRoleArn: farRole.arn,
			deploymentConfigName: deploymentConfig.id,
			deploymentStyle: {
				deploymentOption: "WITH_TRAFFIC_CONTROL",
				deploymentType: "BLUE_GREEN",
			},
		});

		return {
			application,
			deploymentConfig,
			deploymentGroup,
		};
	})();

	return all([
		ecr.repository.arn,
		ecr.repository.repositoryUrl,
		ecr.repository.name,
		codedeploy.application.arn,
		codedeploy.application.name,
		codedeploy.deploymentConfig.arn,
		codedeploy.deploymentConfig.deploymentConfigName,
		codedeploy.deploymentGroup.arn,
		codedeploy.deploymentGroup.deploymentGroupName,
	]).apply(
		([
			ecrRepositoryArn,
			ecrRepositoryUrl,
			ecrRepositoryName,
			codedeployApplicationArn,
			codedeployApplicationName,
			codedeployDeploymentConfigArn,
			codedeployDeploymentConfigName,
			codedeployDeploymentGroupArn,
			codedeployDeploymentGroupName,
		]) => {
			return {
				paloma_codestar_ecr: {
					repository: {
						arn: ecrRepositoryArn,
						url: ecrRepositoryUrl,
						name: ecrRepositoryName,
					},
				},
				paloma_codestar_codedeploy: {
					application: {
						arn: codedeployApplicationArn,
						name: codedeployApplicationName,
					},
					deploymentConfig: {
						arn: codedeployDeploymentConfigArn,
						name: codedeployDeploymentConfigName,
					},
					deploymentGroup: {
						arn: codedeployDeploymentGroupArn,
						name: codedeployDeploymentGroupName,
					},
				},
			};
		},
	);
};
