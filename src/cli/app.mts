import { buildApplication, buildRouteMap } from "@stricli/core";
// import { } from "./commands/echo.js";
import {} from "./commands/apply.js";

const math = buildRouteMap({
	routes: {
		// log: buildUnaryMathCommand("log"),
		// sqrt: buildUnaryMathCommand("sqrt"),
		// pow: buildBinaryMathCommand("pow"),
		// max: buildVariadicMathCommand("max"),
		// min: buildVariadicMathCommand("min"),
	},
	docs: {
		brief: "Various math operations",
	},
});

const root = buildRouteMap({
	routes: {
		// echo,
		math,
	},
	docs: {
		brief: "All available example commands",
	},
});

export const app = buildApplication(root, {
	name: "paloma",
});
