import { z } from "zod";

export const PalomaNevadaChannelsStackrefRoot = "nevada-channels";

export const PalomaNevadaChannelsStackExportsZod = z
	.object({
		paloma_nevada_channels_sns: z.object({
			revalidate: z.object({
				topic: z.object({
					arn: z.string(),
					name: z.string(),
					id: z.string(),
				}),
			}),
		}),
	})
	.passthrough();
