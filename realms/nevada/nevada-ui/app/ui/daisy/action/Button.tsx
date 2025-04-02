import clsx from "clsx";
import type { FC, JSX, PropsWithChildren } from "hono/jsx";

export type DaisyButtonColor =
	| "neutral"
	| "primary"
	| "secondary"
	| "accent"
	| "info"
	| "success"
	| "warning"
	| "error";
export type DaisyButtonVariant = "outline" | "dash" | "soft" | "ghost" | "link";
export type DaisyButtonBehavior = "active" | "disabled";
export type DaisyButtonSize = "xs" | "sm" | "md" | "lg" | "xl";
export type DaisyButtonModifier = "wide" | "block" | "square" | "circle";

export type ButtonProps = {
	renderAs?: "button" | "a";
	color?: DaisyButtonColor;
	matchContentColor?: boolean;
	variant?: DaisyButtonVariant;
	size?: DaisyButtonSize;
} & {
	[key in DaisyButtonBehavior]?: boolean;
} & {
	[key in DaisyButtonModifier]?: boolean;
};

export const Button: FC<
	| (PropsWithChildren<JSX.HTMLAttributes> &
			Omit<ButtonProps, "renderAs"> & { renderAs?: "button" })
	| (PropsWithChildren<JSX.HTMLAttributes> &
			Omit<ButtonProps, "renderAs"> & { renderAs: "a"; href: string })
> = ({ children, className, renderAs, ...buttonProps }) => {
	const {
		wide,
		block,
		square,
		circle,
		active,
		disabled,
		color,
		variant,
		size,
		matchContentColor,
		...htmlProps
	} = buttonProps;
	const { neutral, primary, secondary, accent, info, success, warning, error } =
		{ [color ?? "neutral"]: true } as Record<string, boolean>;
	const { outline, dash, soft, ghost, link } = variant
		? ({ [variant]: true } as Record<string, boolean>)
		: {};
	const { xs, sm, md, lg, xl } = size
		? ({ [size]: true } as Record<string, boolean>)
		: {};

	const buttonClass = clsx(
		"btn",
		className,
		neutral ? "btn-neutral" : undefined,
		neutral && matchContentColor ? "text-neutral-content" : undefined,
		primary ? "btn-primary" : undefined,
		primary && matchContentColor ? "text-primary-content" : undefined,
		secondary ? "btn-secondary" : undefined,
		secondary && matchContentColor ? "text-secondary-content" : undefined,
		accent ? "btn-accent" : undefined,
		accent && matchContentColor ? "text-accent-content" : undefined,
		info ? "btn-info" : undefined,
		info && matchContentColor ? "text-info-content" : undefined,
		success ? "btn-success" : undefined,
		success && matchContentColor ? "text-success-content" : undefined,
		warning ? "btn-warning" : undefined,
		warning && matchContentColor ? "text-warning-content" : undefined,
		error ? "btn-error" : undefined,
		error && matchContentColor ? "text-error-content" : undefined,
		outline ? "btn-outline" : undefined,
		dash ? "btn-dash" : undefined,
		soft ? "btn-soft" : undefined,
		ghost ? "btn-ghost" : undefined,
		link ? "btn-link" : undefined,
		active ? "btn-active" : undefined,
		disabled ? "btn-disabled" : undefined,
		xs ? "btn-xs" : undefined,
		sm ? "btn-sm" : undefined,
		md ? "btn-md" : undefined,
		lg ? "btn-lg" : undefined,
		xl ? "btn-xl" : undefined,
		wide ? "btn-wide" : undefined,
		block ? "btn-block" : undefined,
		square ? "btn-square" : undefined,
		circle ? "btn-circle" : undefined,
	);

	return renderAs === "a" ? (
		<a className={buttonClass} {...htmlProps}>
			{children}
		</a>
	) : (
		<button className={buttonClass} {...htmlProps}>
			{children}
		</button>
	);
};
