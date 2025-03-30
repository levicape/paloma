import { inspect } from "node:util";
import { Context } from "@levicape/fourtwo-pulumi/commonjs/context/Context.cjs";
import { IdentityPool } from "@pulumi/aws/cognito";
import { all, interpolate } from "@pulumi/pulumi";
import { error, warn } from "@pulumi/pulumi/log";
import { RandomId } from "@pulumi/random/RandomId";
import type { z } from "zod";
import { $deref } from "../../Stack";
import {
	PalomaApplicationRoot,
	PalomaApplicationStackExportsZod,
} from "../../application/exports";
import { PalomaIdpOidcStackExportsZod } from "./exports";

const PACKAGE_NAME = "@levicape/paloma";
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
	},
};

export = async () => {
	// Stack references
	const dereferenced$ = await $deref(STACKREF_CONFIG);
	const context = await Context.fromConfig({
		aws: {
			awsApplication: dereferenced$.application.servicecatalog.application.tag,
		},
	});
	const _ = (name: string) => `${context.prefix}-${name}`;
	context.resourcegroups({ _ });

	const identityPoolId = new RandomId(_("pool-id"), {
		byteLength: 4,
	});
	const identityPoolName = _("pool").replace(/[^a-zA-Z0-9_]/g, "-");
	const identityPool = new IdentityPool(_("pool"), {
		identityPoolName: interpolate`${identityPoolName}-${identityPoolId.hex}`,
		developerProviderName: _("developer-provider"),
		tags: {
			Name: _("pool"),
			PackageName: PACKAGE_NAME,
		},
	});
	const identityPoolOutput = all([
		identityPool.arn,
		identityPool.identityPoolName,
		identityPool.id,
		identityPool.supportedLoginProviders,
		identityPool.cognitoIdentityProviders,
		identityPool.developerProviderName,
		identityPool.openidConnectProviderArns,
		identityPool.samlProviderArns,
	]).apply(
		([
			arn,
			identityPoolName,
			id,
			supportedLoginProviders,
			cognitoIdentityProviders,
			developerProviderName,
			openidConnectProviderArns,
			samlProviderArns,
		]) => {
			return {
				arn,
				identityPoolName,
				id,
				supportedLoginProviders,
				cognitoIdentityProviders,
				developerProviderName,
				openidConnectProviderArns,
				samlProviderArns,
			};
		},
	);

	return all([identityPoolOutput]).apply(([idpool]) => {
		const exported = {
			paloma_idp_oidc_cognito: {
				pool: idpool,
			},
		} satisfies z.infer<typeof PalomaIdpOidcStackExportsZod>;

		const validate = PalomaIdpOidcStackExportsZod.safeParse(exported);
		if (!validate.success) {
			error(`Validation failed: ${JSON.stringify(validate.error, null, 2)}`);
			warn(inspect(exported, { depth: null }));
		}

		return exported;
	});
};
