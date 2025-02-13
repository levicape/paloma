import type { PromiseActivity } from "../../canary/activity/PromiseActivity.mjs";

// biome-ignore format: Biome removes the trailing comma in the generic type
export const PromiseTaskActivityDelta = async <
	Enter = unknown,
>(
	activity: PromiseActivity<Enter>,
) => {
	await activity.task({ events: { enter: "TODO" as Enter } });
};
