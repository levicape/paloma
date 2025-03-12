import { inspect } from "node:util";
import { Context } from "@levicape/fourtwo-pulumi/commonjs/context/Context.cjs";
import { IdentityPool } from "@pulumi/aws/cognito";
import { all, interpolate } from "@pulumi/pulumi";
import { error, warn } from "@pulumi/pulumi/log";
import { RandomId } from "@pulumi/random/RandomId";
import type { z } from "zod";
import { $deref } from "../Stack";
import {
	PalomaApplicationRoot,
	PalomaApplicationStackExportsZod,
} from "../application/exports";
import { PalomaCognitoStackExportsZod } from "./exports";

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

	const identityPoolId = new RandomId(_("identitypool-id"), {
		byteLength: 4,
	});
	const identityPoolName = _("identitypool").replace(/[^a-zA-Z0-9_]/g, "-");
	const identityPool = new IdentityPool(_("identitypool"), {
		identityPoolName: interpolate`${identityPoolName}-${identityPoolId.hex}`,
		tags: {
			Name: _("identitypool"),
			PackageName: PACKAGE_NAME,
		},
	});

	// const userPool = new UserPool(_("userpool"), {
	// 	adminCreateUserConfig: {
	// 		"allowAdminCreateUserOnly": true
	// 	},
	//     tags: {
	//         PackageName: PACKAGE_NAME,
	//     },
	// });

	// const userPoolClient = new UserPoolClient(_("userpool-client"), {
	//     userPoolId: userPool.id,
	// });

	// const userPoolDomain = new UserPoolDomain(_("userpool-domain"), {
	//     userPoolId: userPool.id,
	//     domain: `org`,
	// });

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

	// Return the stack outputs
	return all([identityPoolOutput]).apply(([idpool]) => {
		const exported = {
			paloma_cognito_identity_pool: {
				pool: idpool,
			},
		} satisfies z.infer<typeof PalomaCognitoStackExportsZod>;

		// Validate the stack outputs against the Zod schema
		const validate = PalomaCognitoStackExportsZod.safeParse(exported);
		if (!validate.success) {
			error(`Validation failed: ${JSON.stringify(validate.error, null, 2)}`);
			warn(inspect(exported, { depth: null }));
		}

		return exported;
	});
};
