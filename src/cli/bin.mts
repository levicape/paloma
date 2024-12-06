#!/usr/bin/env node --experimental-strip-types
import { run } from "@stricli/core";
import { app } from "./app.mjs";

await run(app, process.argv.slice(2), { process });
