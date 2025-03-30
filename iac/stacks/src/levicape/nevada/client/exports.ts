import { z } from "zod";

export const PalomaNevadaClientOauthRoutes = {
	callback: "~oidc/callback",
	renew: "~oidc/renew",
	logout: "~oidc/logout",
} as const;

export const PalomaNevadaClientStackrefRoot = "nevada-client";

export const PalomaNevadaClientStackExportsZod = z
	.object({
		paloma_nevada_client_cognito: z.object({
			operators: z.object({
				client: z.object({
					name: z.string(),
					clientId: z.string(),
					userPoolId: z.string(),
				}),
			}),
		}),
	})
	.passthrough();
