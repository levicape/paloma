import clsx from "clsx";
import type { DOMAttributes } from "hono/jsx";

export type SkeletonProps = {
	className?: string;
	/**
	 *
	 * Replace the root `<div>` with a different element
	 */
	render?: "div" | "span" | "p" | "section" | "article" | "header" | "footer";
};

/**
 * Skeleton component used for blocking out content while loading
 */
export const Skeleton = ({
	className,
	render,
	...htmlProps
}: SkeletonProps & DOMAttributes) => {
	const Render = render ?? "div";
	return <Render className={clsx("skeleton", className)} {...htmlProps} />;
};
