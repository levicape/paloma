import clsx from "clsx";
import type { Child, DOMAttributes, FC, PropsWithChildren } from "hono/jsx";

export type NavbarProps = {
	className?: string;
	background?: `bg-${string}`;
	text?: `text-${string}`;
	shadow?: `shadow-${string}` | null;
	start?: Child;
	startHtmlProps?: DOMAttributes;
	startClassName?: string;
	center?: Child;
	centerHtmlProps?: DOMAttributes;
	centerClassName?: string;
	end?: Child;
	endHtmlProps?: DOMAttributes;
	endClassName?: string;
};

export const Navbar: FC<PropsWithChildren<NavbarProps> & DOMAttributes> = (
	props,
) => {
	const {
		background,
		text,
		shadow,
		start,
		center,
		end,
		children,
		className,
		startHtmlProps,
		startClassName,
		centerHtmlProps,
		centerClassName,
		endHtmlProps,
		endClassName,
		...htmlProps
	} = props;
	return (
		<header
			className={clsx(
				"navbar",
				background,
				text,
				shadow === null ? undefined : (shadow ?? "shadow-sm"),
				className,
			)}
			{...htmlProps}
		>
			{start ? (
				<div
					className={clsx("navbar-start", startClassName)}
					{...startHtmlProps}
				>
					{start}
				</div>
			) : null}
			{center ? (
				<div
					className={clsx("navbar-center", centerClassName)}
					{...centerHtmlProps}
				>
					{center}
				</div>
			) : null}
			{end ? (
				<div className={clsx("navbar-end", endClassName)} {...endHtmlProps}>
					{end}
				</div>
			) : null}
			{children}
		</header>
	);
};
