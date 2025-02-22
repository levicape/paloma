#!/usr/bin/env -S node --no-warnings --watch

import { Atlas } from "@levicape/spork-atlas";

const { NEVADA_UI, NEVADA_HTTP } = process.env;

export const NevadaIoRoutemap = Atlas({
	"/": {
		$kind: "ComposeRouteResource",
		hostname: `ui:${NEVADA_UI}`,
		protocol: "http",
	},
	"/~/v1/Paloma/Nevada": {
		$kind: "ComposeRouteResource",
		hostname: `http:${NEVADA_HTTP}`,
		protocol: "http",
	},
});
