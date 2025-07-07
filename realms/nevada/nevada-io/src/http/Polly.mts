#!/usr/bin/env -S node --no-warnings --watch
import { Atlas } from "@levicape/spork-polly";
import { env } from "std-env";

const { NEVADA_UI, NEVADA_HTTP } = env;

export const HTTP_BASE_PATH = "/~/Paloma/Nevada";
export const NevadaIoRoutemap = Atlas.routes({
	"/": {
		$kind: "StaticRouteResource",
		hostname: `ui:${NEVADA_UI}`,
		protocol: "http",
	},
	"/~/Paloma/Nevada": {
		$kind: "StaticRouteResource",
		hostname: `http:${NEVADA_HTTP}`,
		protocol: "http",
	},
});
