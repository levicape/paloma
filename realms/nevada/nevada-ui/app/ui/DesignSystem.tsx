import clsx from "clsx";
import { Fragment, type PropsWithChildren } from "hono/jsx";
import { ApplicationHead } from "../variant/ApplicationHead";

export type DesignSystemProps = {
	id?: string;
	className?: string;
};

export const DesignSystemComponents = {
	Shell: "Shell",
	Header: "Header",
	Menubar: "Menubar",
	Commandline: "Commandline",
	ContentLayout: "ContentLayout",
	FootingLayout: "FootingLayout",
	Footer: "Footer",
};
export type DesignSystemId =
	(typeof DesignSystemComponents)[keyof typeof DesignSystemComponents];
/**
 * DesignSystem is a namespace that contains normalized components that wrap the app markup
 */
export namespace DesignSystem {
	/**
	 * css: body > Shell
	 */
	export function Shell({
		children,
		className,
	}: PropsWithChildren<{ className?: string }>) {
		return (
			<div
				id={DesignSystemComponents.Shell}
				className={clsx(
					"bg-base-100/10",
					"overflow-hidden",
					"min-h-screen",
					"bg-fixed",
					"text-base-content",
					className,
					"z-[1]",
				)}
			>
				{children}
			</div>
		);
	}
	/**
	 * css: Shell > #Header
	 */
	export function Header({
		children,
		id,
		className,
	}: PropsWithChildren<DesignSystemProps>) {
		return (
			<header
				id={id ?? DesignSystemComponents.Header}
				className={clsx(
					"text-2xl",
					"font-black",
					"font-stretch-extra-expanded",
					"z-40",
					className,
				)}
			>
				{children}
			</header>
		);
	}
	/**
	 * css: Shell > #Header > #Commandline
	 */
	export function Commandline({ id, className }: DesignSystemProps) {
		return (
			<span
				id={id ?? DesignSystemComponents.Commandline}
				className={className}
			/>
		);
	}
	/**
	 * css: Shell > #Menubar
	 */
	export function Menubar({
		children,
		id,
		className,
	}: PropsWithChildren<DesignSystemProps>) {
		return (
			<nav id={id ?? DesignSystemComponents.Menubar} className={className}>
				{children}
			</nav>
		);
	}

	/**
	 * Fallback is a component used for suspense fallback rendering
	 * css: Shell > #Fallback
	 */
	export function Fallback() {
		return (
			<div
				className={clsx(
					"w-20",
					"h-20",
					"loading-spinner",
					"absolute",
					"top-1/2",
					"left-1/2",
					"-translate-x-1/2",
					"-translate-y-1/2",
					"z-20",
					"bg-neutral/90",
					"border-8",
					"border-primary-500/30",
					"rounded-full",
					"animate-spin",
					"duration-500",
					"ease-in-out",
					"delay-150",
					"transform",
					"origin-center",
					"shadow-lg",
					"shadow-accent-500/50",
					"backdrop-blur-sm",
					"backdrop-brightness-50",
					"backdrop-saturate-50",
					"backdrop-hue-rotate-0",
					"backdrop-blend-normal",
					"backdrop-filter",
					"backdrop-opacity-90",
				)}
			/>
		);
	}

	/**
	 * ContentLayout is a sibling of the Header and Menubar components
	 * css: Shell > ContentLayout
	 */
	export function ContentLayout({ children }: PropsWithChildren) {
		return (
			<Fragment>
				<div
					id={DesignSystemComponents.ContentLayout}
					className={clsx(
						"min-h-50",
						"bg-base-200/60",
						"md:pt-0.5",
						"sm:mx-1",
						"md:-mx-1",
						"sm:px-0.5",
						"md:px-2",
						"md:rounded-box",
						"bg-gradient-to-t",
						"from-base-100/80",
						"to-base-200/40",
						"z-20",
						"isolate",
					)}
				>
					{children}
				</div>
			</Fragment>
		);
	}

	/**
	 * css: #Shell > #Footer
	 */
	export function Footer({
		children,
		id,
		className,
	}: PropsWithChildren<DesignSystemProps>) {
		return (
			<footer
				id={id ?? DesignSystemComponents.Footer}
				className={clsx(
					className,
					"text-sm",
					"text-primary-content/20",
					"dark:text-primary-content/20",
					"font-light",
					"font-sans",
					"font-stretch-condensed",
					"transform-gpu",
					"will-change-[opacity,transform,translate]",
					"transition-all",
					"duration-[100s]",

					"mx-20",
					"z-10",
				)}
			>
				{children ?? ApplicationHead.footer.default}
			</footer>
		);
	}
}
