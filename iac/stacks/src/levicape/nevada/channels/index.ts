import { inspect } from "node:util";
import { Context } from "@levicape/fourtwo-pulumi/commonjs/context/Context.cjs";
import { Topic, type TopicArgs } from "@pulumi/aws/sns/topic";
import { error, warn } from "@pulumi/pulumi/log";
import { Output, all } from "@pulumi/pulumi/output";
import type { z } from "zod";
import { objectEntries, objectFromEntries } from "../../../Object";
import { $$root, $deref } from "../../../Stack";
import {
	PalomaApplicationRoot,
	PalomaApplicationStackExportsZod,
} from "../../../application/exports";
import { PalomaNevadaWWWRootSubdomain } from "../wwwroot/exports";
import { PalomaNevadaChannelsStackExportsZod } from "./exports";

const PACKAGE_NAME = "@levicape/paloma-nevada-io" as const;
const SUBDOMAIN =
	process.env["STACKREF_SUBDOMAIN"] ?? PalomaNevadaWWWRootSubdomain;

const APPLICATION_IMAGE_NAME = PalomaApplicationRoot;
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

	// Resources
	const sns = (() => {
		const topic = (name: string, args: TopicArgs) => {
			return new Topic(_(`topic-${name}`), {
				tags: {
					PackageName: PACKAGE_NAME,
					StackRef: STACKREF_ROOT,
					Subdomain: SUBDOMAIN,
				},
			});
		};
		return {
			revalidate: topic("revalidate", {
				displayName: `${context.prefix} - revalidate (${PACKAGE_NAME})`,
			}),
		};
	})();

	const snsOutput = Output.create(
		objectFromEntries(
			objectEntries(sns).map(([key, value]) => [
				key,
				all([value.arn, value.id, value.name]).apply(([arn, id, name]) => ({
					topic: {
						arn,
						id,
						name,
					},
				})),
			]),
		),
	);

	return all([snsOutput]).apply(([sns]) => {
		const exported = {
			paloma_nevada_channels_sns: sns,
		} satisfies z.infer<typeof PalomaNevadaChannelsStackExportsZod>;

		const validate = PalomaNevadaChannelsStackExportsZod.safeParse(exported);
		if (!validate.success) {
			error(`Validation failed: ${JSON.stringify(validate.error, null, 2)}`);
			warn(inspect(exported, { depth: null }));
		}

		return $$root(APPLICATION_IMAGE_NAME, STACKREF_ROOT, exported);
	});
};
