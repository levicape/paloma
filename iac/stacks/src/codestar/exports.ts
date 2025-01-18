import { z } from "zod";

export const PalomaCodestarStackExportsZod = z.object({
	paloma_codestar_ecr: z.object({
		repository: z.object({
			arn: z.string(),
			url: z.string(),
			name: z.string(),
		}),
	}),
	paloma_codestar_codedeploy: z.object({
		application: z.object({
			arn: z.string(),
			name: z.string(),
		}),
		deploymentConfig: z.object({
			arn: z.string(),
			name: z.string(),
		}),
		deploymentGroup: z.object({
			arn: z.string(),
			name: z.string(),
		}),
	}),
});
