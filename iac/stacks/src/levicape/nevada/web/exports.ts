import { z } from "zod";
import { S3RouteResourceZod } from "../../../RouteMap";

export const PalomaNevadaWebStackrefRoot = "nevada-web" as const;

export const PalomaNevadaWebStackExportsZod = z
	.object({
		paloma_nevada_web_s3: z.object({
			pipeline: z.object({
				bucket: z.string(),
			}),
			artifacts: z.object({
				bucket: z.string(),
			}),
			staticwww: z.object({
				bucket: z.string(),
				public: z.object({
					arn: z.string(),
					domainName: z.string(),
					websiteEndpoint: z.string(),
					websiteDomain: z.string(),
				}),
			}),
		}),
		paloma_nevada_web_codebuild: z.object({
			project: z.object({
				arn: z.string(),
				name: z.string(),
			}),
		}),
		paloma_nevada_web_pipeline: z.object({
			pipeline: z.object({
				arn: z.string(),
				name: z.string(),
			}),
		}),
		paloma_nevada_web_eventbridge: z.object({
			EcrImageAction: z.object({
				rule: z.object({
					arn: z.string(),
					name: z.string(),
				}),
				targets: z.object({
					pipeline: z.object({
						arn: z.string(),
						targetId: z.string(),
					}),
				}),
			}),
		}),
		paloma_nevada_web_routemap: z.record(S3RouteResourceZod),
	})
	.passthrough();
