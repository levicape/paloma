import { inspect } from "node:util";
import { Context } from "@levicape/fourtwo-pulumi/commonjs/context/Context.cjs";
import {
	UserPoolClient,
	type UserPoolClientArgs,
} from "@pulumi/aws/cognito/userPoolClient";
import { all } from "@pulumi/pulumi";
import { error, warn } from "@pulumi/pulumi/log";
import type { z } from "zod";
import { objectEntries, objectFromEntries } from "../../../Object";
import { $deref } from "../../../Stack";
import {
	PalomaApplicationRoot,
	PalomaApplicationStackExportsZod,
} from "../../../application/exports";
import {
	PalomaDnsRootStackExportsZod,
	PalomaDnsRootStackrefRoot,
} from "../../../dns/root/exports";
import {
	PalomaIdpUsersStackExportsZod,
	PalomaIdpUsersStackrefRoot,
} from "../../../idp/users/exports";
import { PalomaNevadaWWWRootSubdomain } from "../wwwroot/exports";
import {
	PalomaNevadaClientOauthRoutes,
	PalomaNevadaClientStackExportsZod,
} from "./exports";

const SUBDOMAIN =
	process.env["STACKREF_SUBDOMAIN"] ?? PalomaNevadaWWWRootSubdomain;
const STACKREF_ROOT = process.env["STACKREF_ROOT"] ?? PalomaApplicationRoot;
const STACKREF_CONFIG = {
	[STACKREF_ROOT]: {
		application: {
			refs: {
				servicecatalog:
					PalomaApplicationStackExportsZod.shape
						.paloma_application_servicecatalog,
			},
		},
		[PalomaDnsRootStackrefRoot]: {
			refs: {
				acm: PalomaDnsRootStackExportsZod.shape.paloma_dns_root_acm,
			},
		},
		[PalomaIdpUsersStackrefRoot]: {
			refs: {
				cognito: PalomaIdpUsersStackExportsZod.shape.paloma_idp_users_cognito,
			},
		},
	},
};

export = async () => {
	const dereferenced$ = await $deref(STACKREF_CONFIG);
	const context = await Context.fromConfig({
		aws: {
			awsApplication: dereferenced$.application.servicecatalog.application.tag,
		},
	});
	const _ = (name: string) => `${context.prefix}-${name}`;
	context.resourcegroups({ _ });

	const { cognito } = dereferenced$[PalomaIdpUsersStackrefRoot];
	const { acm } = dereferenced$[PalomaDnsRootStackrefRoot];
	const domainName = (() => {
		const domainName = acm.certificate?.domainName;
		if (domainName?.startsWith("*.")) {
			return domainName.slice(2);
		}
		return domainName;
	})();

	/**
	 * Cognito User Pool Clients
	 */
	const clients = (() => {
		const userpoolclient = (
			name: string,
			userPoolId: string,
			config?: Omit<UserPoolClientArgs, "userPoolId">,
		) => {
			/**
			 * Subdomain relative to the hosted zone
			 */
			const callbackDomain = `${SUBDOMAIN}.${domainName}`;
			const client = new UserPoolClient(_(`${name}-client`), {
				userPoolId,
				allowedOauthFlows: ["code", "implicit"],
				allowedOauthFlowsUserPoolClient: true,
				allowedOauthScopes: [
					"email",
					"openid",
					"profile",
					"aws.cognito.signin.user.admin",
				],
				authSessionValidity: 7,
				callbackUrls: [`https://${callbackDomain}`].flatMap((url) => [
					url.endsWith("/") ? url.slice(0, -1) : url,
					...Object.values(PalomaNevadaClientOauthRoutes).map(
						(route) => `${url}/${route}`,
					),
				]),
				enableTokenRevocation: true,
				logoutUrls: [
					`https://${callbackDomain}/${PalomaNevadaClientOauthRoutes.logout}`,
				],
				preventUserExistenceErrors: "ENABLED",
				supportedIdentityProviders: ["COGNITO"],
				...(config ?? {}),
			});

			return { client };
		};

		const userPoolId = cognito.operators.pool.id;
		return {
			operators: userpoolclient("operators", userPoolId),
		};
	})();

	const clientsOutput = all(objectEntries(clients)).apply((entries) =>
		objectFromEntries(
			entries.map(([name, { client }]) => [
				name,
				all([
					all([client.id, client.name, client.userPoolId]).apply(
						([clientId, name, userPoolId]) => ({
							clientId,
							name,
							userPoolId,
						}),
					),
				]).apply(([client]) => {
					return {
						client,
					};
				}),
			]),
		),
	);

	return all([clientsOutput]).apply(([clients]) => {
		const exported = {
			paloma_nevada_client_cognito: {
				operators: clients.operators,
			},
		} satisfies z.infer<typeof PalomaNevadaClientStackExportsZod>;

		const validate = PalomaNevadaClientStackExportsZod.safeParse(exported);
		if (!validate.success) {
			error(`Validation failed: ${JSON.stringify(validate.error, null, 2)}`);
			warn(inspect(exported, { depth: null }));
		}

		return exported;
	});
};
