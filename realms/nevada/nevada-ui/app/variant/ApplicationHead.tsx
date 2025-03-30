import { process } from "std-env";
export const ApplicationName = "Nevada";

export const ApplicationHead = {
	title: {
		template: `%s | ${ApplicationName}`,
		default: ApplicationName,
	},
	description:
		"The Nevada platform provides visibility for Activity executions.",
	metadataBase:
		(process?.env.URL !== undefined && new URL(process.env.URL)) || undefined,
	openGraph: {
		type: "website",
		title: ApplicationName,
		url: process.env.URL,
		images: [`${process.env.URL}/static/social/splash.png`],
	},
} as const;
