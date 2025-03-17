#!/usr/bin/env -S node --no-warnings --watch

import { Atlas } from "@levicape/spork-atlas";

const { NEVADA_UI } = process.env;

export const NevadaUiRoutemap = Atlas.routes({
	"/": {
		$kind: "StaticRouteResource",
		hostname: `ui:${NEVADA_UI}`,
		protocol: "http",
	},
});
