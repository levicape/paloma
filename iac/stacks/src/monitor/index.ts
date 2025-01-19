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
import { Pipeline } from "@pulumi/aws/codepipeline";
import { getAuthorizationToken } from "@pulumi/aws/ecr/getAuthorizationToken";
import { ManagedPolicy } from "@pulumi/aws/iam";
import { getRole } from "@pulumi/aws/iam/getRole";
import { RolePolicy } from "@pulumi/aws/iam/rolePolicy";
import { RolePolicyAttachment } from "@pulumi/aws/iam/rolePolicyAttachment";
import { Alias, Function as LambdaFn, Permission } from "@pulumi/aws/lambda";
import {
	Bucket,
	BucketServerSideEncryptionConfigurationV2,
} from "@pulumi/aws/s3";
import { BucketObjectv2 } from "@pulumi/aws/s3/bucketObjectv2";
import { BucketPublicAccessBlock } from "@pulumi/aws/s3/bucketPublicAccessBlock";
import { BucketVersioningV2 } from "@pulumi/aws/s3/bucketVersioningV2";
import { Image } from "@pulumi/docker-build";
import { Output, all, getStack } from "@pulumi/pulumi";
import { stringify } from "yaml";
import { $ref, $val } from "../Stack";
import { PalomaCodestarStackExportsZod } from "../codestar/exports";
import { PalomaDatalayerStackExportsZod } from "../datalayer/exports";

export = async () => {
	const context = await Context.fromConfig();
	const _ = (name: string) => `${context.prefix}-${name}`;
	// TODO: From $CI_ENVIRONMENT
	const stage = "current";
	const farRole = await getRole({ name: "FourtwoAccessRole" });

	// Stack references
	const __codestar = await (async () => {
		const code = $ref("paloma-codestar");
		return {
			codedeploy: $val(
				(await code.getOutputDetails("paloma_codestar_codedeploy")).value,
				PalomaCodestarStackExportsZod.shape.paloma_codestar_codedeploy,
			),
			ecr: $val(
				(await code.getOutputDetails("paloma_codestar_ecr")).value,
				PalomaCodestarStackExportsZod.shape.paloma_codestar_ecr,
			),
		};
	})();

	const __datalayer = await (async () => {
		const data = $ref("paloma-datalayer");
		return {
			props: $val(
				(await data.getOutputDetails("_PALOMA_DATALAYER_PROPS")).value,
				PalomaDatalayerStackExportsZod.shape._PALOMA_DATALAYER_PROPS,
			),
			ec2: $val(
				(await data.getOutputDetails("paloma_datalayer_ec2")).value,
				PalomaDatalayerStackExportsZod.shape.paloma_datalayer_ec2,
			),
			efs: $val(
				(await data.getOutputDetails("paloma_datalayer_efs")).value,
				PalomaDatalayerStackExportsZod.shape.paloma_datalayer_efs,
			),
			iam: $val(
				(await data.getOutputDetails("paloma_datalayer_iam")).value,
				PalomaDatalayerStackExportsZod.shape.paloma_datalayer_iam,
			),
			cloudmap: $val(
				(await data.getOutputDetails("paloma_datalayer_cloudmap")).value,
				PalomaDatalayerStackExportsZod.shape.paloma_datalayer_cloudmap,
			),
		};
	})();
	//

	// Object Store
	const s3 = (() => {
		const bucket = (name: string) => {
			const bucket = new Bucket(_(name), {
				acl: "private",
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

			return bucket;
		};
		return {
			artifactStore: bucket("artifact-store"),
			assets: bucket("assets"),
			build: bucket("build"),
			deploy: bucket("deploy"),
		};
	})();

	// Logging
	const cloudwatch = (() => {
		const loggroup = new LogGroup(_("loggroup"), {
			retentionInDays: 365,
		});

		return {
			loggroup,
		};
	})();

	// Compute
	const handler = async (
		{ entrypoint, name }: { entrypoint: string; name: string },
		{
			datalayer,
			codestar,
		}: { datalayer: typeof __datalayer; codestar: typeof __codestar },
		cw: typeof cloudwatch,
	) => {
		const role = datalayer.iam.roles.lambda.name;
		const roleArn = datalayer.iam.roles.lambda.arn;
		const loggroup = cw.loggroup;

		// Bootstrap container lambda with empty image.
		const ecrCredentials = await getAuthorizationToken({});
		new Image(_(`${name}-kickstart-image`), {
			tags: [`${codestar.ecr.repository.url}:kickstart`],
			push: true,
			pull: true,
			registries: [
				{
					address: ecrCredentials.proxyEndpoint,
					username: ecrCredentials.userName,
					password: ecrCredentials.password,
				},
			],
			dockerfile: {
				inline: `FROM busybox:latest`,
			},
		});

		const lambdaPolicyDocument = all([loggroup.arn]).apply(([loggroupArn]) => {
			return {
				Version: "2012-10-17",
				Statement: [
					//   {
					// 	Effect: "Allow",
					// 	Action: [
					// 	  "dynamodb:DescribeStream",
					// 	  "dynamodb:GetRecords",
					// 	  "dynamodb:GetShardIterator",
					// 	  "dynamodb:ListStreams",
					// 	],
					// 	Resource: "*",
					//   },
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

		const lambda = new LambdaFn(
			_(`${name}-handler-lambda`),
			{
				role: roleArn,
				architectures: ["arm64"],
				memorySize: Number.parseInt("256"),
				timeout: 48,
				packageType: "Image",
				imageUri: `${codestar.ecr.repository.url}:kickstart`,
				imageConfig: {
					entryPoints: [entrypoint],
					// "canaryserver"],
				},
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
					applicationLogLevel: "DEBUG",
				},
				environment: all([cloudmapEnvironment]).apply(([cloudmapEnv]) => {
					return {
						variables: {
							...cloudmapEnv,
						},
					};
				}),
			},
			{
				ignoreChanges: ["imageUri"],
			},
		);

		const version = new Version(_(`${name}-handler-version`), {
			functionName: lambda.name,
			description: `(${getStack()}) Version ${stage}`,
		});

		const alias = new Alias(
			_(`${name}-handler-alias`),
			{
				name: stage,
				functionName: lambda.name,
				functionVersion: version.version,
			},
			{
				ignoreChanges: ["functionVersion"],
			},
		);

		return {
			role: datalayer.props.lambda.role,
			lambda: {
				arn: lambda.arn,
				name: lambda.name,
				alias,
				version,
			},
		};
	};

	const deps = {
		datalayer: __datalayer,
		codestar: __codestar,
	} as const;

	const canary = {
		harness: await handler(
			{
				entrypoint: "canaryharness",
				name: "canaryharness",
			},
			deps,
			cloudwatch,
		),
		server: await handler(
			{
				entrypoint: "canaryserver",
				name: "canaryserver",
			},
			deps,
			cloudwatch,
		),
	} as const;

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
							schedulehandler: new CodeDeployAppspecResourceBuilder()
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

		const buildspec = (() => {
			const content = stringify(
				new CodeBuildBuildspecBuilder()
					.setVersion("0.2")
					.setArtifacts(
						new CodeBuildBuildspecArtifactsBuilder()
							.setFiles(["appspec.yml", "appspec.zip"])
							.setName("schedulehandler_update"),
					)
					.setEnv(
						new CodeBuildBuildspecEnvBuilder().setVariables({
							APPSPEC_TEMPLATE: appspec({
								name: "<LAMBDA_FUNCTION_NAME>",
								alias: "<LAMBDA_FUNCTION_ALIAS>",
								currentVersion: "<CURRENT_VERSION>",
								targetVersion: "<TARGET_VERSION>",
							}).content,
							SOURCE_IMAGE_REPOSITORY: "<SOURCE_IMAGE_REPOSITORY>",
							SOURCE_IMAGE_URI: "<SOURCE_IMAGE_URI>",
							LAMBDA_FUNCTION_NAME: "<LAMBDA_FUNCTION_NAME>",
						}),
					)
					.setPhases({
						build:
							new CodeBuildBuildspecResourceLambdaPhaseBuilder().setCommands([
								"env",
								`export CURRENT_VERSION=$(aws lambda get-function --qualifier ${stage} --function-name $LAMBDA_FUNCTION_NAME --query 'Configuration.Version' --output text)`,
								"echo $CURRENT_VERSION",
								"aws lambda update-function-code --function-name $LAMBDA_FUNCTION_NAME --image-uri $SOURCE_IMAGE_URI --publish > .version",
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
							]),
					})
					.build(),
			);

			const upload = new BucketObjectv2(_("buildspec-upload"), {
				bucket: s3.deploy.bucket,
				content,
				key: "Buildspec.yml",
			});

			return {
				content,
				upload,
			};
		})();

		const project = (() => {
			const project = new Project(_("codebuild-project"), {
				description: `(${getStack()}) CodeBuild project`,
				buildTimeout: 8,
				serviceRole: farRole.arn,
				artifacts: {
					type: "CODEPIPELINE",
					artifactIdentifier: "schedulehandler_update",
				},
				environment: {
					type: "ARM_LAMBDA_CONTAINER",
					computeType: "BUILD_LAMBDA_1GB",
					image: "aws/codebuild/amazonlinux-aarch64-lambda-standard:nodejs20",
					environmentVariables: [
						{
							name: "SOURCE_IMAGE_REPOSITORY",
							value: "SourceImage.RepositoryName",
							type: "PLAINTEXT",
						},
						{
							name: "SOURCE_IMAGE_URI",
							value: "SourceImage.ImageUri",
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
					],
				},
				source: {
					type: "CODEPIPELINE",
					buildspec: buildspec.content,
				},
			});

			return {
				project,
			};
		})();

		return {
			...project,
			spec: {
				buildspec,
			},
		};
	})();

	const codepipeline = (() => {
		const pipeline = new Pipeline(_("schedule-handler-pipeline"), {
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
					name: "ScheduleCanary",
					actions: [
						{
							canary: canary.harness.lambda,
							prefix: "Harness",
							artifactPrefix: "schedulecanaryharness",
							deployOrder: 2,
						},
						{
							canary: canary.server.lambda,
							prefix: "Server",
							artifactPrefix: "schedulecanaryserver",
							deployOrder: 3,
						},
					].flatMap(({ canary, prefix, artifactPrefix, deployOrder }) => {
						return [
							{
								runOrder: 1,
								name: `Update${prefix}`,
								namespace: `ScheduleCanary${prefix}Update`,
								category: "Build",
								owner: "AWS",
								provider: "CodeBuild",
								version: "1",
								inputArtifacts: ["source_image"],
								outputArtifacts: [artifactPrefix],
								configuration: all([
									codebuild.project.name,
									canary.name,
									canary.alias.name,
								]).apply(([projectName, functionName, aliasName]) => {
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
										]),
									};
								}),
							},
							{
								runOrder: deployOrder,
								name: `Cutover${prefix}`,
								category: "Deploy",
								owner: "AWS",
								provider: "CodeDeploy",
								version: "1",
								inputArtifacts: [artifactPrefix],
								configuration: all([
									__codestar.codedeploy.application.name,
									__codestar.codedeploy.deploymentGroup.name,
								]).apply(([applicationName, deploymentGroupName]) => {
									return {
										ApplicationName: applicationName,
										DeploymentGroupName: deploymentGroupName,
									};
								}),
							},
						];
					}),
				},
			],
		});

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
			const rule = new EventRule(_("event-ecr-push-rule"), {
				description: `(${getStack()}) ECR push event rule`,
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
			});
			const pipeline = new EventTarget(_("event-ecr-push-target-pipeline"), {
				rule: rule.name,
				arn: codepipeline.pipeline.arn,
				roleArn: farRole.arn,
			});

			return {
				rule,
				targets: {
					pipeline,
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
				[[]] as Array<[string, typeof canary.harness.lambda][]>,
			)
			.filter((group) => group.length > 0);

		const OnSchedule = (() => {
			const targets = Object.fromEntries(
				groups.flatMap((group, idx) => {
					const rule = new EventRule(_(`schedule-${idx}`), {
						description: `(${getStack()}) Schedule event rule ${idx}`,
						state: "ENABLED",
						scheduleExpression: "rate(8 minutes)",
					});

					return group.map(([key, handler]) => {
						const target = new EventTarget(_(`schedule-${idx}-${key}`), {
							rule: rule.name,
							arn: handler.alias.arn,
						});

						const permission = new Permission(_(`schedule-${idx}-${key}-iam`), {
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

	return all([
		s3.artifactStore.bucket,
		s3.assets.bucket,
		s3.build.bucket,
		s3.deploy.bucket,
		cloudwatch.loggroup.arn,
		Output.create(
			Object.fromEntries(
				Object.entries(canary).map(([key, handler]) => {
					return [
						key,
						all([
							handler.role.arn,
							handler.role.name,
							handler.lambda.arn,
							handler.lambda.version.version,
							handler.lambda.alias.arn,
							handler.lambda.alias.name,
							handler.lambda.alias.functionVersion,
						]).apply(
							([
								roleArn,
								roleName,
								lambdaArn,
								lambdaVersion,
								aliasArn,
								aliasName,
								aliasVersion,
							]) => ({
								role: {
									arn: roleArn,
									name: roleName,
								},
								lambda: {
									arn: lambdaArn,
									version: {
										version: lambdaVersion,
									},
									alias: {
										arn: aliasArn,
										name: aliasName,
										functionVersion: aliasVersion,
									},
								},
							}),
						),
					];
				}),
			),
		).apply((r) => JSON.stringify(r)),
		codebuild.project.arn,
		codebuild.project.name,
		codepipeline.pipeline.arn,
		codepipeline.pipeline.name,
		eventbridge.EcrImageAction.rule.arn,
		eventbridge.EcrImageAction.rule.name,
		eventbridge.EcrImageAction.targets.pipeline.arn,
		eventbridge.EcrImageAction.targets.pipeline.targetId,
		Output.create(
			Object.fromEntries(
				Object.entries(eventbridge.OnSchedule.targets).map(([key, target]) => {
					return [
						key,
						all([
							target.rule.arn,
							target.rule.name,
							target.target.arn,
							target.target.targetId,
						]).apply(([ruleArn, ruleName, targetArn, targetId]) => ({
							rule: {
								arn: ruleArn,
								name: ruleName,
							},
							target: {
								arn: targetArn,
								targetId: targetId,
							},
						})),
					];
				}),
			),
		).apply((r) => JSON.stringify(r)),
	]).apply(
		([
			artifactStoreBucket,
			assetsBucket,
			buildBucket,
			deployBucket,
			cloudwatchLoggroupArn,
			canaryLambdas,
			codebuildProjectArn,
			codebuildProjectName,
			pipelineArn,
			pipelineName,
			ecrImageEventRuleArn,
			ecrImageEventRuleName,
			ecrImageEventTargetArn,
			ecrImageEventTargetId,
			scheduleEventRules,
		]) => {
			return {
				_PALOMA_MONITOR_IMPORTS: {
					paloma: {
						codestar: __codestar,
						datalayer: __datalayer,
					},
				},
				paloma_monitor_s3: {
					build: {
						bucket: buildBucket,
					},
					deploy: {
						bucket: deployBucket,
					},
					artifactStore: {
						bucket: artifactStoreBucket,
					},
					assets: {
						bucket: assetsBucket,
					},
				},
				paloma_monitor_cloudwatch: {
					loggroup: {
						arn: cloudwatchLoggroupArn,
					},
				},
				paloma_monitor_canary: JSON.parse(canaryLambdas),
				paloma_monitor_codebuild: {
					project: {
						arn: codebuildProjectArn,
						name: codebuildProjectName,
					},
				},
				paloma_monitor_pipeline: {
					pipeline: {
						arn: pipelineArn,
						name: pipelineName,
					},
				},
				paloma_monitor_eventbridge: {
					EcrImageAction: {
						rule: {
							arn: ecrImageEventRuleArn,
							name: ecrImageEventRuleName,
						},
						targets: {
							pipeline: {
								arn: ecrImageEventTargetArn,
								targetId: ecrImageEventTargetId,
							},
						},
					},
					OnSchedule: JSON.parse(scheduleEventRules),
				},
			};
		},
	);
};
