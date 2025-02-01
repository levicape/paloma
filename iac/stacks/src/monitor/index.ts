import {
	CodeBuildBuildspecArtifactsBuilder,
	CodeBuildBuildspecBuilder,
	CodeBuildBuildspecEnvBuilder,
	CodeBuildBuildspecResourceLambdaPhaseBuilder,
	CodeDeployAppspecBuilder,
	CodeDeployAppspecResourceBuilder,
} from "@levicape/fourtwo-builders";
import { Context } from "@levicape/fourtwo-pulumi";
import { Version } from "@pulumi/aws-native/lambda";
import { EventRule, EventTarget } from "@pulumi/aws/cloudwatch";
import { LogGroup } from "@pulumi/aws/cloudwatch/logGroup";
import { Project } from "@pulumi/aws/codebuild";
import { DeploymentGroup } from "@pulumi/aws/codedeploy/deploymentGroup";
import { Pipeline } from "@pulumi/aws/codepipeline";
import { ManagedPolicy } from "@pulumi/aws/iam";
import { getRole } from "@pulumi/aws/iam/getRole";
import { RolePolicy } from "@pulumi/aws/iam/rolePolicy";
import { RolePolicyAttachment } from "@pulumi/aws/iam/rolePolicyAttachment";
import {
	Alias,
	Function as LambdaFn,
	Permission,
	Runtime,
} from "@pulumi/aws/lambda";
import {
	Bucket,
	BucketLifecycleConfigurationV2,
	BucketServerSideEncryptionConfigurationV2,
} from "@pulumi/aws/s3";
import { BucketObjectv2 } from "@pulumi/aws/s3/bucketObjectv2";
import { BucketPublicAccessBlock } from "@pulumi/aws/s3/bucketPublicAccessBlock";
import { BucketVersioningV2 } from "@pulumi/aws/s3/bucketVersioningV2";
import { Output, all } from "@pulumi/pulumi";
import { AssetArchive } from "@pulumi/pulumi/asset/archive";
import { StringAsset } from "@pulumi/pulumi/asset/asset";
import { stringify } from "yaml";
import type { z } from "zod";
import { $deref } from "../Stack";
import { PalomaCodestarStackExportsZod } from "../codestar/exports";
import { PalomaDatalayerStackExportsZod } from "../datalayer/exports";
import { PalomaNevadaMonitorStackExportsZod } from "./exports";

const PACKAGE_NAME = "@levicape/paloma";
const CANARY_PATHS = [
	{
		name: "execution",
		description: "Tests basic Paloma state machine execution",
		packageName: "@levicape/paloma-examples-canaryexecution",
		handler: "module/canary/execution.LambdaHandler",
	},
	// {
	// 	name: "server",
	// 	packageName: "@levicape/paloma-example",
	// 	handler: "module/canary/server.handler",
	// },
] as const;
const LLRT_ARCH: string | undefined = process.env["LLRT_ARCH"]; //"lambda-arm64-full-sdk";

const CI = {
	CI_ENVIRONMENT: process.env.CI_ENVIRONMENT ?? "unknown",
	CI_ACCESS_ROLE: process.env.CI_ACCESS_ROLE ?? "FourtwoAccessRole",
};

const STACKREF_ROOT = process.env["STACKREF_ROOT"] ?? "paloma";
const STACKREF_CONFIG = {
	[STACKREF_ROOT]: {
		codestar: {
			refs: {
				codedeploy:
					PalomaCodestarStackExportsZod.shape.paloma_codestar_codedeploy,
				ecr: PalomaCodestarStackExportsZod.shape.paloma_codestar_ecr,
			},
		},
		datalayer: {
			refs: {
				props: PalomaDatalayerStackExportsZod.shape.paloma_datalayer_props,
				iam: PalomaDatalayerStackExportsZod.shape.paloma_datalayer_iam,
				cloudmap:
					PalomaDatalayerStackExportsZod.shape.paloma_datalayer_cloudmap,
			},
		},
	},
};

export = async () => {
	const context = await Context.fromConfig();
	const _ = (name?: string) =>
		name ? `${context.prefix}-${name}` : context.prefix;
	const stage = CI.CI_ENVIRONMENT;
	const farRole = await getRole({ name: CI.CI_ACCESS_ROLE });

	// Stack references
	const { codestar: __codestar, datalayer: __datalayer } =
		await $deref(STACKREF_CONFIG);

	// Object Store
	const s3 = (() => {
		const bucket = (name: string) => {
			const bucket = new Bucket(_(name), {
				acl: "private",
				tags: {
					Name: _(name),
					StackRef: STACKREF_ROOT,
					PackageName: PACKAGE_NAME,
					Key: name,
				},
			});

			new BucketServerSideEncryptionConfigurationV2(_(`${name}-encryption`), {
				bucket: bucket.bucket,
				rules: [
					{
						applyServerSideEncryptionByDefault: {
							sseAlgorithm: "AES256",
						},
					},
				],
			});
			new BucketVersioningV2(
				_(`${name}-versioning`),

				{
					bucket: bucket.bucket,
					versioningConfiguration: {
						status: "Enabled",
					},
				},
				{ parent: this },
			);
			new BucketPublicAccessBlock(_(`${name}-public-access-block`), {
				bucket: bucket.bucket,
				blockPublicAcls: true,
				blockPublicPolicy: true,
				ignorePublicAcls: true,
				restrictPublicBuckets: true,
			});

			new BucketLifecycleConfigurationV2(_(`${name}-lifecycle`), {
				bucket: bucket.bucket,
				rules: [
					{
						status: "Enabled",
						id: "ExpireObjects",
						expiration: {
							days: context.environment.isProd ? 30 : 12,
						},
					},
				],
			});

			return bucket;
		};
		return {
			artifactStore: bucket("artifact-store"),
			build: bucket("build"),
			deploy: bucket("deploy"),
		};
	})();

	// Logging
	const cloudwatch = (() => {
		const loggroup = new LogGroup(_("logs"), {
			retentionInDays: context.environment.isProd ? 14 : 180,
			tags: {
				Name: _("logs"),
				StackRef: STACKREF_ROOT,
				PackageName: PACKAGE_NAME,
			},
		});

		return {
			loggroup,
		};
	})();

	// Compute
	const handler = async (
		{ name, description, packageName, handler }: (typeof CANARY_PATHS)[number],
		{
			datalayer,
			codestar,
		}: { datalayer: typeof __datalayer; codestar: typeof __codestar },
		cw: typeof cloudwatch,
	) => {
		const role = datalayer.iam.roles.lambda.name;
		const roleArn = datalayer.iam.roles.lambda.arn;
		const loggroup = cw.loggroup;

		const lambdaPolicyDocument = all([loggroup.arn]).apply(([loggroupArn]) => {
			return {
				Version: "2012-10-17",
				Statement: [
					{
						Effect: "Allow",
						Action: [
							"ec2:CreateNetworkInterface",
							"ec2:DescribeNetworkInterfaces",
							"ec2:DeleteNetworkInterface",
						],
						Resource: "*",
					},
					{
						Effect: "Allow",
						Action: [
							"logs:CreateLogGroup",
							"logs:CreateLogStream",
							"logs:PutLogEvents",
						],
						Resource: loggroupArn,
					},
				],
			};
		});

		new RolePolicy(_(`${name}-policy`), {
			role,
			policy: lambdaPolicyDocument.apply((lpd) => JSON.stringify(lpd)),
		});

		[
			["basic", ManagedPolicy.AWSLambdaBasicExecutionRole],
			["vpc", ManagedPolicy.AWSLambdaVPCAccessExecutionRole],
			["efs", ManagedPolicy.AmazonElasticFileSystemClientReadWriteAccess],
			["cloudmap", ManagedPolicy.AWSCloudMapDiscoverInstanceAccess],
			["s3", ManagedPolicy.AmazonS3ReadOnlyAccess],
			["ssm", ManagedPolicy.AmazonSSMReadOnlyAccess],
			["xray", ManagedPolicy.AWSXrayWriteOnlyAccess],
		].forEach(([policy, policyArn]) => {
			new RolePolicyAttachment(_(`${name}-policy-${policy}`), {
				role,
				policyArn,
			});
		});

		const cloudmapEnvironment = {
			AWS_CLOUDMAP_NAMESPACE_ID: datalayer.cloudmap.namespace.id,
			AWS_CLOUDMAP_NAMESPACE_NAME: datalayer.cloudmap.namespace.name,
		};

		const zip = new BucketObjectv2(_(`${name}-zip`), {
			bucket: s3.deploy.bucket,
			source: new AssetArchive({
				"index.js": new StringAsset(
					`export const handler = (${(
						// @ts-ignore
						(_event, context) => {
							const {
								functionName,
								functionVersion,
								getRemainingTimeInMillis,
								invokedFunctionArn,
								memoryLimitInMB,
								awsRequestId,
								logGroupName,
								logStreamName,
								identity,
								clientContext,
								deadline,
							} = context;

							console.log({
								functionName,
								functionVersion,
								getRemainingTimeInMillis,
								invokedFunctionArn,
								memoryLimitInMB,
								awsRequestId,
								logGroupName,
								logStreamName,
								identity,
								clientContext,
								deadline,
							});

							return {
								statusCode: 200,
								body: JSON.stringify({
									message: "Hello from Lambda!",
								}),
							};
						}
					).toString()})`,
				),
			}),
			contentType: "application/zip",
			key: "monitor.zip",
			tags: {
				Name: _(`${name}-monitor`),
				StackRef: STACKREF_ROOT,
			},
		});

		const lambda = new LambdaFn(
			_(`${name}`),
			{
				description: `(${packageName}) "${description ?? `Monitor lambda ${name}`}" in #${stage}`,
				role: roleArn,
				architectures: ["arm64"],
				memorySize: Number.parseInt(context.environment.isProd ? "512" : "256"),
				timeout: 93,
				packageType: "Zip",
				runtime: LLRT_ARCH ? Runtime.CustomAL2023 : Runtime.NodeJS22dX,
				handler: "index.handler",
				s3Bucket: s3.deploy.bucket,
				s3Key: zip.key,
				s3ObjectVersion: zip.versionId,
				vpcConfig: {
					securityGroupIds: datalayer.props.lambda.vpcConfig.securityGroupIds,
					subnetIds: datalayer.props.lambda.vpcConfig.subnetIds,
				},
				fileSystemConfig: {
					localMountPath:
						datalayer.props.lambda.fileSystemConfig.localMountPath,
					arn: datalayer.props.lambda.fileSystemConfig.arn,
				},
				loggingConfig: {
					logFormat: "JSON",
					logGroup: cloudwatch.loggroup.name,
					applicationLogLevel: context.environment.isProd ? "INFO" : "DEBUG",
				},
				environment: all([cloudmapEnvironment]).apply(([cloudmapEnv]) => {
					return {
						variables: {
							...cloudmapEnv,
							NODE_ENV: "production",
							LOG_LEVEL: "5",
						},
					};
				}),
				tags: {
					Name: _(name),
					StackRef: STACKREF_ROOT,
					Handler: "Monitor",
					Monitor: name,
					PackageName: packageName,
				},
			},
			{
				dependsOn: zip,
				ignoreChanges: ["handler", "s3Key", "s3ObjectVersion"],
			},
		);

		const version = new Version(_(`${name}-version`), {
			description: `(${packageName}) Version for ${stage}`,
			functionName: lambda.name,
		});

		const alias = new Alias(
			_(`${name}-alias`),
			{
				name: stage,
				description: `(${packageName}) Alias for ${stage}`,
				functionName: lambda.name,
				functionVersion: version.version,
			},
			{
				ignoreChanges: ["functionVersion"],
			},
		);

		const deploymentGroup = new DeploymentGroup(
			_(`${name}-deployment-group`),
			{
				deploymentGroupName: lambda.arn.apply((arn) =>
					_(`${name}-deploybg-${arn.slice(-5)}`),
				),
				appName: codestar.codedeploy.application.name,
				deploymentConfigName: codestar.codedeploy.deploymentConfig.name,
				serviceRoleArn: farRole.arn,
				deploymentStyle: {
					deploymentOption: "WITH_TRAFFIC_CONTROL",
					deploymentType: "BLUE_GREEN",
				},
			},
			{
				deleteBeforeReplace: true,
				dependsOn: [alias],
				replaceOnChanges: [
					"appName",
					"deploymentConfigName",
					"deploymentStyle",
				],
			},
		);

		// Codebuild
		const codebuild = (() => {
			const appspec = (props: {
				name: string;
				alias: string;
				currentVersion: string;
				targetVersion: string;
			}) => {
				const content = stringify(
					new CodeDeployAppspecBuilder()
						.setResources([
							{
								httphandler: new CodeDeployAppspecResourceBuilder()
									.setName(props.name)
									.setAlias(props.alias)
									.setCurrentVersion(props.currentVersion)
									.setTargetVersion(props.targetVersion),
							},
						])
						.build(),
				);
				return {
					content,
				};
			};

			const project = (() => {
				const PIPELINE_STAGE = "monitorhandler" as const;
				const EXTRACT_ACTION = "extractimage" as const;
				const UPDATE_ACTION = "updatelambda" as const;

				const stages = [
					{
						stage: PIPELINE_STAGE,
						action: EXTRACT_ACTION,
						artifact: {
							name: `${PIPELINE_STAGE}_${name}_${EXTRACT_ACTION}`,
							baseDirectory: ".extractimage" as string | undefined,
							files: ["**/*"] as string[],
						},
						variables: {
							STACKREF_CODESTAR_ECR_REPOSITORY_ARN:
								"<STACKREF_CODESTAR_ECR_REPOSITORY_ARN>",
							STACKREF_CODESTAR_ECR_REPOSITORY_NAME:
								"<STACKREF_CODESTAR_ECR_REPOSITORY_NAME>",
							STACKREF_CODESTAR_ECR_REPOSITORY_URL:
								"<STACKREF_CODESTAR_ECR_REPOSITORY_URL>",
							SOURCE_IMAGE_REPOSITORY: "<SOURCE_IMAGE_REPOSITORY>",
							SOURCE_IMAGE_URI: "<SOURCE_IMAGE_URI>",
							S3_DEPLOY_BUCKET: "<S3_DEPLOY_BUCKET>",
							S3_DEPLOY_KEY: "<S3_DEPLOY_KEY>",
							CANARY_NAME: "<CANARY_NAME>",
							PACKAGE_NAME: "<PACKAGE_NAME>",
						},
						exportedVariables: [
							"STACKREF_CODESTAR_ECR_REPOSITORY_ARN",
							"STACKREF_CODESTAR_ECR_REPOSITORY_NAME",
							"STACKREF_CODESTAR_ECR_REPOSITORY_URL",
							"S3_DEPLOY_BUCKET",
							"S3_DEPLOY_KEY",
							"DeployKey",
						] as string[],
						environment: {
							type: "ARM_CONTAINER",
							computeType: "BUILD_GENERAL1_SMALL",
							image: "aws/codebuild/amazonlinux-aarch64-standard:3.0",
							environmentVariables: [
								{
									name: "STACKREF_CODESTAR_ECR_REPOSITORY_ARN",
									value: "<STACKREF_CODESTAR_ECR_REPOSITORY_ARN>",
									type: "PLAINTEXT",
								},
								{
									name: "STACKREF_CODESTAR_ECR_REPOSITORY_NAME",
									value: "<STACKREF_CODESTAR_ECR_REPOSITORY_NAME>",
									type: "PLAINTEXT",
								},
								{
									name: "STACKREF_CODESTAR_ECR_REPOSITORY_URL",
									value: "<STACKREF_CODESTAR_ECR_REPOSITORY_URL>",
									type: "PLAINTEXT",
								},
								{
									name: "SOURCE_IMAGE_REPOSITORY",
									value: "SourceImage.RepositoryName",
									type: "PLAINTEXT",
								},
								{
									name: "SOURCE_IMAGE_URI",
									value: "SourceImage.ImageURI",
									type: "PLAINTEXT",
								},
								{
									name: "S3_DEPLOY_BUCKET",
									value: s3.deploy.bucket,
									type: "PLAINTEXT",
								},
								{
									name: "S3_DEPLOY_KEY",
									value: "SourceImage.ImageURI",
									type: "PLAINTEXT",
								},
								{
									name: "CANARY_NAME",
									value: "<CANARY_NAME>",
									type: "PLAINTEXT",
								},
								{
									name: "PACKAGE_NAME",
									value: "<PACKAGE_NAME>",
									type: "PLAINTEXT",
								},
							] as { name: string; value: string; type: "PLAINTEXT" }[],
						},
						phases: {
							build: [
								"env",
								"docker --version",
								`aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $STACKREF_CODESTAR_ECR_REPOSITORY_URL`,
								"docker pull $SOURCE_IMAGE_URI",
								"docker images",
								[
									"docker run",
									"--detach",
									"--entrypoint",
									"deploy",
									`-e DEPLOY_FILTER=$PACKAGE_NAME`,
									`-e DEPLOY_OUTPUT=/tmp/monitorhandler`,
									"$SOURCE_IMAGE_URI",
									"> .container",
								].join(" "),
								"docker ps -al",
								"cat .container",
								"sleep 10s",
								`docker container logs $(cat .container)`,
								"sleep 9s",
								`docker container logs $(cat .container)`,
								"sleep 8s",
								`docker container logs $(cat .container)`,
								"mkdir -p $CODEBUILD_SRC_DIR/.extractimage || true",
								`docker cp $(cat .container):/tmp/monitorhandler $CODEBUILD_SRC_DIR/.extractimage`,
								"ls -al $CODEBUILD_SRC_DIR/.extractimage || true",
								"ls -al $CODEBUILD_SRC_DIR/.extractimage/monitorhandler || true",
								"corepack -g install pnpm@9 || true",
								"pnpm -C $CODEBUILD_SRC_DIR/.extractimage/monitorhandler install --offline --prod --ignore-scripts --node-linker=hoisted || true",
								"ls -al $CODEBUILD_SRC_DIR/.extractimage/monitorhandler/node_modules || true",
								`NODE_NO_WARNINGS=1 node -e '(${(
									// biome-ignore lint/complexity/useArrowFunction:
									function () {
										const deploykey = (
											process.env.S3_DEPLOY_KEY ?? "UNKNOWN"
										).replace(/[^a-zA-Z0-9-_.]/g, "_");
										process.stdout.write(deploykey);
									}
								).toString()})()' > .deploykey`,
								"cat .deploykey",
								"aws s3 ls s3://$S3_DEPLOY_BUCKET",
								`export DeployKey=$(cat .deploykey)_$CANARY_NAME`,
								`echo $DeployKey`,
							] as string[],
						},
					},
					{
						stage: PIPELINE_STAGE,
						action: UPDATE_ACTION,
						artifact: {
							name: `${PIPELINE_STAGE}_${name}_${UPDATE_ACTION}`,
							baseDirectory: undefined as string | undefined,
							files: ["appspec.yml", "appspec.zip"] as string[],
						},
						variables: {
							APPSPEC_TEMPLATE: appspec({
								name: "<LAMBDA_FUNCTION_NAME>",
								alias: "<LAMBDA_FUNCTION_ALIAS>",
								currentVersion: "<CURRENT_VERSION>",
								targetVersion: "<TARGET_VERSION>",
							}).content,
							SOURCE_IMAGE_REPOSITORY: "<SOURCE_IMAGE_REPOSITORY>",
							SOURCE_IMAGE_URI: "<SOURCE_IMAGE_URI>",
							LAMBDA_FUNCTION_NAME: "<LAMBDA_FUNCTION_NAME>",
							S3_DEPLOY_BUCKET: "<S3_DEPLOY_BUCKET>",
							S3_DEPLOY_KEY: "<S3_DEPLOY_KEY>",
							LAMBDA_HANDLER: "<LAMBDA_HANDLER>",
							DeployKey: "<DeployKey>",
						},
						exportedVariables: undefined as string[] | undefined,
						environment: {
							type: "ARM_LAMBDA_CONTAINER",
							computeType: "BUILD_LAMBDA_2GB",
							image:
								"aws/codebuild/amazonlinux-aarch64-lambda-standard:nodejs20",
							environmentVariables: [
								{
									name: "SOURCE_IMAGE_REPOSITORY",
									value: "SourceImage.RepositoryName",
									type: "PLAINTEXT",
								},
								{
									name: "SOURCE_IMAGE_URI",
									value: "SourceImage.ImageURI",
									type: "PLAINTEXT",
								},
								{
									name: "LAMBDA_FUNCTION_NAME",
									value: "LAMBDA_FUNCTION_NAME",
									type: "PLAINTEXT",
								},
								{
									name: "LAMBDA_FUNCTION_ALIAS",
									value: "LAMBDA_FUNCTION_ALIAS",
									type: "PLAINTEXT",
								},
								{
									name: "S3_DEPLOY_BUCKET",
									value: s3.deploy.bucket,
									type: "PLAINTEXT",
								},
								{
									name: "S3_DEPLOY_KEY",
									value: "SourceImage.ImageURI",
									type: "PLAINTEXT",
								},
								{
									name: "DeployKey",
									value: `monitorhandler_${name}_extractimage.DeployKey`,
									type: "PLAINTEXT",
								},
								{
									name: "LAMBDA_HANDLER",
									value: "<LAMBDA_HANDLER>",
									type: "PLAINTEXT",
								},
							] as { name: string; value: string; type: "PLAINTEXT" }[],
						},
						phases: {
							build: [
								"env",
								"aws s3 ls s3://$S3_DEPLOY_BUCKET",
								`export CURRENT_VERSION=$(aws lambda get-function --qualifier ${stage} --function-name $LAMBDA_FUNCTION_NAME --query 'Configuration.Version' --output text)`,
								"echo $CURRENT_VERSION",
								[
									"aws lambda update-function-configuration",
									"--function-name $LAMBDA_FUNCTION_NAME",
									`--handler $LAMBDA_HANDLER`,
								].join(" "),
								"echo $DeployKey",
								[
									"aws lambda update-function-code",
									"--function-name $LAMBDA_FUNCTION_NAME",
									"--s3-bucket $S3_DEPLOY_BUCKET",
									"--s3-key $DeployKey",
									"--publish",
									"> .version",
								].join(" "),
								"export TARGET_VERSION=$(jq -r '.Version' .version)",
								"echo $TARGET_VERSION",
								"echo $APPSPEC_TEMPLATE",
								`NODE_NO_WARNINGS=1 node -e '(${(
									// biome-ignore lint/complexity/useArrowFunction:
									function () {
										const template = process.env.APPSPEC_TEMPLATE;
										const lambdaArn = process.env.LAMBDA_FUNCTION_NAME;
										const lambdaAlias = process.env.LAMBDA_FUNCTION_ALIAS;
										const currentVersion = process.env.CURRENT_VERSION;
										const targetVersion = process.env.TARGET_VERSION;

										if (!template) {
											throw new Error("APPSPEC_TEMPLATE not set");
										}

										if (currentVersion === targetVersion) {
											throw new Error("Version is the same");
										}

										const appspec = template
											.replace("<LAMBDA_FUNCTION_NAME>", lambdaArn ?? "!")
											.replace("<LAMBDA_FUNCTION_ALIAS>", lambdaAlias ?? "!")
											.replace("<CURRENT_VERSION>", currentVersion ?? "!")
											.replace("<TARGET_VERSION>", targetVersion ?? "!");

										process.stdout.write(appspec);
									}
								).toString()})()' > appspec.yml`,
								"cat appspec.yml",
								"zip appspec.zip appspec.yml",
								"ls -al",
							] as string[],
						} as Record<string, string[]>,
					},
				] as const;

				const entries = Object.fromEntries(
					stages.map(
						({
							stage,
							action,
							artifact,
							environment,
							variables,
							phases,
							exportedVariables,
						}) => {
							const artifacts = new CodeBuildBuildspecArtifactsBuilder()
								.setFiles(artifact.files)
								.setName(artifact.name);

							if (artifact.baseDirectory) {
								artifacts.setBaseDirectory(artifact.baseDirectory);
							}

							const env = new CodeBuildBuildspecEnvBuilder().setVariables(
								variables,
							);
							if (exportedVariables) {
								env.setExportedVariables(exportedVariables);
							}

							const content = stringify(
								new CodeBuildBuildspecBuilder()
									.setVersion("0.2")
									.setArtifacts(artifacts)
									.setEnv(env)
									.setPhases({
										build:
											new CodeBuildBuildspecResourceLambdaPhaseBuilder().setCommands(
												phases.build,
											),
									})
									.build(),
							);

							const upload = new BucketObjectv2(
								_(`${artifact.name}-buildspec`),
								{
									bucket: s3.build.bucket,
									content,
									key: `${artifact.name}/Buildspec.yml`,
								},
							);

							const project = new Project(
								_(`${artifact.name}`),
								{
									description: `(${packageName}) Deploy "${stage}" pipeline "${name}" stage: "${action}"`,
									buildTimeout: 12,
									serviceRole: farRole.arn,
									artifacts: {
										type: "CODEPIPELINE",
										artifactIdentifier: artifact.name,
									},
									environment,
									source: {
										type: "CODEPIPELINE",
										buildspec: content,
									},
									tags: {
										Name: _(artifact.name),
										StackRef: STACKREF_ROOT,
										PackageName: packageName,
										Monitor: name,
										DeployStage: stage,
										Action: action,
									},
								},
								{
									dependsOn: [upload],
								},
							);

							return [
								action,
								{
									project,
									buildspec: {
										artifact: `io_${artifact.name}`,
										content,
										namespace: `ns_${stage}_${name}_${action}`,
										upload,
									},
								},
							];
						},
					),
				);

				return entries as Record<
					(typeof stages)[number]["action"],
					{
						project: Project;
						buildspec: {
							artifact: string;
							content: string;
							namespace: string;
							upload: BucketObjectv2;
						};
					}
				>;
			})();

			return {
				...project,
			} as const;
		})();

		return {
			role: datalayer.props.lambda.role,
			codedeploy: {
				application: codestar.codedeploy.application,
				deploymentGroup,
			},
			codebuild,
			environment: {
				CANARY_NAME: name,
				PACKAGE_NAME: packageName,
				LAMBDA_HANDLER: handler,
			},
			lambda: {
				arn: lambda.arn,
				name: lambda.name,
				alias,
				version,
			},
		} as const;
	};

	const deps = {
		datalayer: __datalayer,
		codestar: __codestar,
	} as const;

	const canary = await (async () => {
		return Object.fromEntries(
			await Promise.all(
				CANARY_PATHS.map(async (canary) => {
					return [
						canary.name,
						await handler(canary, deps, cloudwatch),
					] as const;
				}),
			),
		);
	})();

	const codepipeline = (() => {
		const pipeline = new Pipeline(
			_("deploy"),
			{
				pipelineType: "V2",
				roleArn: farRole.arn,
				executionMode: "QUEUED",
				artifactStores: [
					{
						location: s3.artifactStore.bucket,
						type: "S3",
					},
				],
				stages: [
					{
						name: "Source",
						actions: [
							{
								name: "Image",
								namespace: "SourceImage",
								category: "Source",
								owner: "AWS",
								provider: "ECR",
								version: "1",
								outputArtifacts: ["source_image"],
								configuration: all([__codestar.ecr.repository.name]).apply(
									([repositoryName]) => {
										return {
											RepositoryName: repositoryName,
											ImageTag: stage,
										};
									},
								),
							},
						],
					},
					{
						name: "MonitorHandler",
						actions: Object.entries(canary).flatMap(
							([name, { codebuild, lambda, codedeploy, environment }]) => {
								return [
									{
										runOrder: 1,
										name: `${name}_ExtractImage`,
										namespace: codebuild.extractimage.buildspec.namespace,
										category: "Build",
										owner: "AWS",
										provider: "CodeBuild",
										version: "1",
										inputArtifacts: ["source_image"],
										outputArtifacts: [
											codebuild.extractimage.buildspec.artifact,
										],
										configuration: all([
											__codestar.ecr.repository.arn,
											__codestar.ecr.repository.name,
											__codestar.ecr.repository.url,
											codebuild.extractimage.project.name,
											s3.deploy.bucket,
										]).apply(
											([
												repositoryArn,
												repositoryName,
												repositoryUrl,
												projectExtractImageName,
												deployBucketName,
											]) => {
												return {
													ProjectName: projectExtractImageName,
													EnvironmentVariables: JSON.stringify([
														{
															name: "STACKREF_CODESTAR_ECR_REPOSITORY_ARN",
															value: repositoryArn,
															type: "PLAINTEXT",
														},
														{
															name: "STACKREF_CODESTAR_ECR_REPOSITORY_NAME",
															value: repositoryName,
															type: "PLAINTEXT",
														},
														{
															name: "STACKREF_CODESTAR_ECR_REPOSITORY_URL",
															value: repositoryUrl,
															type: "PLAINTEXT",
														},
														{
															name: "SOURCE_IMAGE_REPOSITORY",
															value: "#{SourceImage.RepositoryName}",
															type: "PLAINTEXT",
														},
														{
															name: "SOURCE_IMAGE_URI",
															value: "#{SourceImage.ImageURI}",
															type: "PLAINTEXT",
														},
														{
															name: "S3_DEPLOY_BUCKET",
															value: deployBucketName,
															type: "PLAINTEXT",
														},
														{
															name: "S3_DEPLOY_KEY",
															value: "#{SourceImage.ImageURI}",
															type: "PLAINTEXT",
														},
														{
															name: "CANARY_NAME",
															value: environment.CANARY_NAME,
															type: "PLAINTEXT",
														},
														{
															name: "PACKAGE_NAME",
															value: environment.PACKAGE_NAME,
															type: "PLAINTEXT",
														},
													]),
												};
											},
										),
									},
									{
										runOrder: 2,
										name: `${name}_UploadS3`,
										category: "Deploy",
										owner: "AWS",
										provider: "S3",
										version: "1",
										inputArtifacts: [codebuild.extractimage.buildspec.artifact],
										configuration: all([s3.deploy.bucket]).apply(
											([BucketName]) => ({
												BucketName,
												Extract: "false",
												ObjectKey: `#{${codebuild.extractimage.buildspec.namespace}.DeployKey}`,
											}),
										),
									},
									{
										runOrder: 3,
										name: `${name}_UpdateLambda`,
										namespace: codebuild.updatelambda.buildspec.namespace,
										category: "Build",
										owner: "AWS",
										provider: "CodeBuild",
										version: "1",
										inputArtifacts: [codebuild.extractimage.buildspec.artifact],
										outputArtifacts: [
											codebuild.updatelambda.buildspec.artifact,
										],
										configuration: all([
											codebuild.updatelambda.project.name,
											lambda.name,
											lambda.alias.name,
											s3.deploy.bucket,
										]).apply(
											([
												projectName,
												functionName,
												aliasName,
												deployBucketName,
											]) => {
												return {
													ProjectName: projectName,
													EnvironmentVariables: JSON.stringify([
														{
															name: "SOURCE_IMAGE_REPOSITORY",
															value: "#{SourceImage.RepositoryName}",
															type: "PLAINTEXT",
														},
														{
															name: "SOURCE_IMAGE_URI",
															value: "#{SourceImage.ImageURI}",
															type: "PLAINTEXT",
														},
														{
															name: "LAMBDA_FUNCTION_NAME",
															value: functionName,
															type: "PLAINTEXT",
														},
														{
															name: "LAMBDA_FUNCTION_ALIAS",
															value: aliasName,
															type: "PLAINTEXT",
														},
														{
															name: "S3_DEPLOY_BUCKET",
															value: deployBucketName,
															type: "PLAINTEXT",
														},
														{
															name: "S3_DEPLOY_KEY",
															value: "#{SourceImage.ImageURI}",
															type: "PLAINTEXT",
														},
														{
															name: "DeployKey",
															value: `#{${codebuild.extractimage.buildspec.namespace}.DeployKey}`,
															type: "PLAINTEXT",
														},
														{
															name: "LAMBDA_HANDLER",
															value: `monitorhandler/${environment.LAMBDA_HANDLER}`,
															type: "PLAINTEXT",
														},
													]),
												};
											},
										),
									},
									{
										runOrder: 4,
										name: "Cutover",
										category: "Deploy",
										owner: "AWS",
										provider: "CodeDeploy",
										version: "1",
										inputArtifacts: [codebuild.updatelambda.buildspec.artifact],
										configuration: all([
											__codestar.codedeploy.application.name,
											codedeploy.deploymentGroup.deploymentGroupName,
										]).apply(([applicationName, deploymentGroupName]) => {
											return {
												ApplicationName: applicationName,
												DeploymentGroupName: deploymentGroupName,
											};
										}),
									},
								];
							},
						),
					},
				],
				tags: {
					Name: _("deploy"),
					StackRef: STACKREF_ROOT,
					PackageName: PACKAGE_NAME,
				},
			},
			{
				dependsOn: Object.values(canary).flatMap((canary) => [
					canary.codebuild.extractimage.buildspec.upload,
					canary.codebuild.updatelambda.buildspec.upload,
				]),
			},
		);

		new RolePolicyAttachment(_("codepipeline-rolepolicy"), {
			policyArn: ManagedPolicy.CodePipeline_FullAccess,
			role: farRole.name,
		});

		return {
			pipeline,
		};
	})();

	// Eventbridge will trigger on ecr push
	const eventbridge = (() => {
		const { name } = __codestar.ecr.repository;

		const EcrImageAction = (() => {
			const rule = new EventRule(_("on-ecr-push"), {
				description: `(${PACKAGE_NAME}) ECR image deploy pipeline trigger for tag "${stage}"`,
				state: "ENABLED",
				eventPattern: JSON.stringify({
					source: ["aws.ecr"],
					"detail-type": ["ECR Image Action"],
					detail: {
						"repository-name": [name],
						"action-type": ["PUSH"],
						result: ["SUCCESS"],
						"image-tag": [stage],
					},
				}),
				tags: {
					Name: _(`on-ecr-push`),
					StackRef: STACKREF_ROOT,
				},
			});
			const target = new EventTarget(_("on-ecr-push-deploy"), {
				rule: rule.name,
				arn: codepipeline.pipeline.arn,
				roleArn: farRole.arn,
			});

			return {
				targets: {
					pipeline: {
						rule,
						target,
					},
				},
			};
		})();

		// Max 5 targets per rule
		let groups = Object.entries(canary)
			.reduce(
				(acc, key) => {
					const [name, handler] = key;
					let last = acc[acc.length - 1];
					if (last.length === 5) {
						last = [];
						acc.push(last);
					}
					last.push([name, handler.lambda]);

					return acc;
				},
				[[]] as Array<[string, typeof canary.register.lambda][]>,
			)
			.filter((group) => group.length > 0);

		const OnSchedule = (() => {
			const targets = Object.fromEntries(
				groups.flatMap((group, idx) => {
					const rule = new EventRule(
						_(`on-rate-${idx}`),
						{
							description: `(${PACKAGE_NAME}) Schedule rule for ${group
								.map(([key]) => key)
								.join(", ")}`,
							state: "ENABLED",
							scheduleExpression: `rate(${context.environment.isProd ? "4" : "12"} minutes)`,
							tags: {
								Name: _(`on-rate-${idx}`),
								StackRef: STACKREF_ROOT,
							},
						},
						{
							dependsOn: group.map(([, handler]) => handler.alias),
							deleteBeforeReplace: true,
						},
					);

					return group.map(([key, handler]) => {
						const target = new EventTarget(
							_(`on-rate-${idx}-${key}`),
							{
								rule: rule.name,
								arn: handler.alias.arn,
							},
							{
								dependsOn: handler.alias,
								deleteBeforeReplace: true,
							},
						);

						const permission = new Permission(_(`on-rate-${idx}-${key}-iam`), {
							action: "lambda:InvokeFunction",
							principal: "events.amazonaws.com",
							sourceArn: rule.arn,
							function: handler.arn,
							qualifier: handler.alias.name,
						});

						return [key, { rule, target, permission }] as const;
					});
				}),
			) as Record<
				keyof typeof canary,
				{ target: EventTarget; permission: Permission; rule: EventRule }
			>;

			return {
				targets,
			};
		})();

		return {
			EcrImageAction,
			OnSchedule,
		};
	})();

	// Outputs
	const s3Output = Output.create(
		Object.fromEntries(
			Object.entries(s3).map(([key, bucket]) => {
				return [
					key,
					all([bucket.bucket, bucket.region]).apply(
						([bucketName, bucketRegion]) => ({
							bucket: bucketName,
							region: bucketRegion,
						}),
					),
				];
			}),
		) as Record<keyof typeof s3, Output<{ bucket: string; region: string }>>,
	);

	const cloudwatchOutput = Output.create(cloudwatch).apply((cloudwatch) => ({
		loggroup: all([cloudwatch.loggroup.arn]).apply(([loggroupArn]) => ({
			arn: loggroupArn,
		})),
	}));

	const lambdaOutput = Output.create(canary).apply((canaries) => {
		return Object.fromEntries(
			Object.entries(canaries).map(([name, handler]) => {
				return [
					name,
					{
						role: all([handler.role.arn, handler.role.name]).apply(
							([arn, name]) => ({
								arn,
								name,
							}),
						),
						monitor: all([
							handler.lambda.arn,
							handler.lambda.name,
							handler.lambda.version.version,
							handler.lambda.alias.arn,
							handler.lambda.alias.name,
							handler.lambda.alias.functionVersion,
						]).apply(
							([
								arn,
								lambdaName,
								version,
								aliasArn,
								aliasName,
								functionVersion,
							]) => ({
								arn,
								name: lambdaName,
								version,
								alias: {
									arn: aliasArn,
									name: aliasName,
									functionVersion,
								},
							}),
						),
						codedeploy: all([
							handler.codedeploy.deploymentGroup.arn,
							handler.codedeploy.deploymentGroup.deploymentGroupName,
						]).apply(([arn, name]) => ({ deploymentGroup: { arn, name } })),
					},
				];
			}),
		);
	});

	const codebuildOutput = Output.create(canary).apply((canaries) => {
		return Object.fromEntries(
			Object.entries(canaries).map(([name, handler]) => {
				return [
					name,
					Output.create(handler.codebuild).apply(
						(codebuild) =>
							Object.fromEntries(
								Object.entries(codebuild).map(([key, resources]) => {
									return [
										key,
										all([
											resources.project.arn,
											resources.project.name,
											resources.buildspec.upload.bucket,
											resources.buildspec.upload.key,
										]).apply(
											([projectArn, projectName, bucketName, bucketKey]) => ({
												buildspec: {
													artifact: resources.buildspec.artifact,
													bucket: bucketName,
													key: bucketKey,
													namespace: resources.buildspec.namespace,
												},
												project: {
													arn: projectArn,
													name: projectName,
												},
											}),
										),
									];
								}),
							) as Record<
								keyof typeof handler.codebuild,
								Output<{
									buildspec: {
										artifact: string;
										bucket: string;
										key: string;
										namespace: string;
									};
									project: { arn: string; name: string };
								}>
							>,
					),
				];
			}),
		);
	});

	const codepipelineOutput = Output.create(codepipeline).apply(
		(codepipeline) => ({
			pipeline: all([
				codepipeline.pipeline.arn,
				codepipeline.pipeline.name,
				codepipeline.pipeline.roleArn,
				codepipeline.pipeline.stages.apply((stages) =>
					stages.map((stage) => ({
						name: stage.name,
						actions: stage.actions.map((action) => ({
							runOrder: action.runOrder,
							name: action.name,
							category: action.category,
							provider: action.provider,
							configuration: action.configuration,
						})),
					})),
				),
			]).apply(([arn, name, roleArn, stages]) => ({
				arn,
				name,
				roleArn,
				stages,
			})),
		}),
	);

	const eventbridgeRulesOutput = Output.create(eventbridge).apply(
		(eventbridge) => {
			return Object.fromEntries(
				Object.entries(eventbridge).map(([key, value]) => {
					return [
						key,
						all([
							Output.create(value.targets).apply(
								(targets) =>
									Object.fromEntries(
										Object.entries(targets).map(([key, event]) => {
											return [
												key,
												all([
													event.rule.arn,
													event.rule.name,
													event.target.arn,
													event.target.targetId,
												]).apply(
													([ruleArn, ruleName, targetArn, targetId]) => ({
														rule: {
															arn: ruleArn,
															name: ruleName,
														},
														target: {
															arn: targetArn,
															id: targetId,
														},
													}),
												),
											];
										}),
									) as Record<
										keyof typeof value.targets,
										Output<{
											rule: { arn: string; name: string };
											target: { arn: string; id: string };
										}>
									>,
							) as Record<
								keyof typeof value.targets,
								Output<{
									rule: { arn: string; name: string };
									target: { arn: string; id: string };
								}>
							>,
						]).apply((targets) => ({
							targets,
						})),
					];
				}),
			) as unknown as Record<
				keyof typeof eventbridge,
				Output<{
					targets: Record<
						keyof (typeof eventbridge)[keyof typeof eventbridge],
						{
							rule: { arn: string; name: string };
							target: { arn: string; id: string };
						}
					>;
				}>
			>;
		},
	);

	return all([
		s3Output,
		cloudwatchOutput,
		lambdaOutput,
		codebuildOutput,
		codepipelineOutput,
		eventbridgeRulesOutput,
	]).apply(
		([
			paloma_nevada_monitor_s3,
			paloma_nevada_monitor_cloudwatch,
			paloma_nevada_monitor_lambda,
			paloma_nevada_monitor_codebuild,
			paloma_nevada_monitor_codepipeline,
			paloma_nevada_monitor_eventbridge,
		]) => {
			const exported = {
				paloma_nevada_monitor_imports: {
					paloma: {
						codestar: __codestar,
						datalayer: __datalayer,
					},
				},
				paloma_nevada_monitor_s3,
				paloma_nevada_monitor_cloudwatch,
				paloma_nevada_monitor_lambda,
				paloma_nevada_monitor_codebuild,
				paloma_nevada_monitor_codepipeline,
				paloma_nevada_monitor_eventbridge,
			} satisfies z.infer<typeof PalomaNevadaMonitorStackExportsZod> & {
				paloma_nevada_monitor_imports: {
					paloma: {
						codestar: typeof __codestar;
						datalayer: typeof __datalayer;
					};
				};
			};
			const validate = PalomaNevadaMonitorStackExportsZod.safeParse(exported);
			if (!validate.success) {
				process.stderr.write(
					`Validation failed: ${JSON.stringify(validate.error, null, 2)}`,
				);
			}

			return exported;
		},
	);
};
