import { clsx } from "clsx";
import type { DOMAttributes } from "hono/jsx";
import { Link } from "react-router";

export type DaisyLinkVariant = "hover";

export type DaisyLinkColor =
	| "neutral"
	| "primary"
	| "secondary"
	| "accent"
	| "info"
	| "success"
	| "warning"
	| "error";

export type LinkProps = {
	color?: DaisyLinkColor;
	className?: string;
} & {
	[variant in DaisyLinkVariant]?: true;
};

export const RouterLink = (
	props: {
		href: string;
	} & DOMAttributes &
		LinkProps,
) => {
	const { href, children, className, hover, color, ...aprops } = props;
	const { neutral, primary, secondary, accent, info, success, warning, error } =
		color ? ({ [color]: true } as Record<string, boolean>) : {};

	return (
		<Link
			to={href}
			className={clsx(
				"link",
				hover ? "link-hover" : undefined,
				neutral ? "link-neutral" : undefined,
				primary ? "link-primary" : undefined,
				secondary ? "link-secondary" : undefined,
				accent ? "link-accent" : undefined,
				info ? "link-info" : undefined,
				success ? "link-success" : undefined,
				warning ? "link-warning" : undefined,
				error ? "link-error" : undefined,
				className,
			)}
			{...aprops}
		>
			{children}
		</Link>
	);
};
