import { z } from "zod";
import { LambdaRouteResourceZod } from "../../../RouteMap";

export const PalomaNevadaHttpStackrefRoot = "nevada-http" as const;

export const PalomaNevadaHttpStackExportsZod = z
	.object({
		paloma_nevada_http_cloudmap: z.object({
			namespace: z.object({
				arn: z.string(),
				name: z.string(),
				id: z.string(),
				hostedZone: z.string(),
			}),
			instance: z.object({
				attributes: z.record(z.string()).nullish(),
				id: z.string(),
			}),
			service: z.object({
				arn: z.string(),
				name: z.string(),
			}),
		}),
		paloma_nevada_http_cloudwatch: z.object({
			build: z.object({
				logGroup: z.object({
					arn: z.string(),
					name: z.string(),
				}),
			}),
			function: z.object({
				logGroup: z.object({
					arn: z.string(),
					name: z.string(),
				}),
			}),
		}),
		paloma_nevada_http_codebuild: z.object({
			httphandler_extractimage: z.object({
				buildspec: z.object({
					bucket: z.string(),
					key: z.string(),
				}),
				project: z.object({
					arn: z.string(),
					name: z.string(),
				}),
			}),
			httphandler_updatelambda: z.object({
				buildspec: z.object({
					bucket: z.string(),
					key: z.string(),
				}),
				project: z.object({
					arn: z.string(),
					name: z.string(),
				}),
			}),
		}),
		paloma_nevada_http_codepipeline: z.object({
			pipeline: z.object({
				arn: z.string(),
				name: z.string(),
				roleArn: z.string(),
				stages: z.array(
					z.object({
						actions: z.array(
							z.object({
								category: z.string(),
								configuration: z.record(z.string().nullish()).nullish(),
								name: z.string(),
								provider: z.string(),
								runOrder: z.number(),
							}),
						),
						name: z.string(),
					}),
				),
			}),
		}),
		paloma_nevada_http_eventbridge: z.record(
			z.object({
				rule: z.object({
					arn: z.string(),
					name: z.string(),
				}),
				targets: z.object({
					pipeline: z.object({
						arn: z.string(),
					}),
				}),
			}),
		),
		paloma_nevada_http_lambda: z.object({
			codedeploy: z.object({
				deploymentGroup: z.object({
					arn: z.string(),
					name: z.string(),
				}),
			}),
			function: z.object({
				alias: z.object({
					arn: z.string(),
					functionVersion: z.string(),
					name: z.string(),
				}),
				arn: z.string(),
				name: z.string(),
				url: z.string(),
				version: z.string(),
			}),
			role: z.object({
				arn: z.string(),
				name: z.string(),
			}),
		}),
		paloma_nevada_http_s3: z.object({
			artifacts: z.object({
				bucket: z.string(),
				region: z.string(),
			}),
			pipeline: z.object({
				bucket: z.string(),
				region: z.string(),
			}),
		}),
		paloma_nevada_http_routemap: z.record(LambdaRouteResourceZod),
	})
	.passthrough();
