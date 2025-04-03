import { process } from "std-env";
export const ApplicationName = "Nevada";

export const ApplicationHead = {
	title: {
		template: `%s | ${ApplicationName}`,
		default: ApplicationName,
	},
	description: [
		"View the status of your Paloma tests with a next-gen observability platform.",
		"Stay informed at all times on the operational health of your mission-critical systems.",
	],
	metadataBase:
		(process?.env.URL !== undefined && new URL(process.env.URL)) || undefined,
	openGraph: {
		type: "website",
		title: ApplicationName,
		url: process.env.URL,
		images: [`${process.env.URL}/static/social/splash.png`],
	},
	footer: {
		default: `Levicape ${new Date().getFullYear()}`,
	},
} as const;
