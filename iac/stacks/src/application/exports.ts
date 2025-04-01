import { z } from "zod";

export const PalomaApplicationRoot = "paloma";

export const PalomaApplicationStackExportsZod = z
	.object({
		paloma_application_servicecatalog: z.object({
			application: z.object({
				arn: z.string(),
				id: z.string(),
				name: z.string(),
				tag: z.string(),
			}),
		}),
		paloma_application_resourcegroups: z.record(
			z.object({
				group: z.object({
					arn: z.string(),
					id: z.string(),
					name: z.string(),
				}),
			}),
		),
		paloma_application_sns: z.object({
			changelog: z.object({
				topic: z.object({
					arn: z.string(),
					name: z.string(),
					id: z.string(),
				}),
			}),
			capacity: z.object({
				topic: z.object({
					arn: z.string(),
					name: z.string(),
					id: z.string(),
				}),
			}),
		}),
	})
	.passthrough();
