import { clsx } from "clsx";
import type { FC } from "hono/jsx";

export type HandRaised_IconProps = {
	className?: string;
	viewBox?: `${number} ${number} ${number} ${number}`;
	width?: `w-${string}`;
	height?: `h-${string}`;
	fill?: `fill-${string}`;
	stroke?: `stroke-${string}`;
};

const getClassName = ({
	className,
	width,
	height,
	fill,
	stroke,
}: HandRaised_IconProps) => {
	return clsx(
		width ?? "w-6",
		height ?? "h-6",
		fill ?? "fill-current",
		stroke ?? "stroke-none",
		"cursor-[inherit]",
		className,
	);
};

export const HandRaised_Icon: FC<HandRaised_IconProps> = (props) => {
	const { viewBox } = props;

	return (
		<svg
			role={"img"}
			aria-label={"Hand Raised Icon"}
			xmlns="http://www.w3.org/2000/svg"
			viewBox={viewBox ?? "0 0 24 24"}
			className={getClassName(props)}
		>
			{" "}
			<path d="M10.5 1.875a1.125 1.125 0 0 1 2.25 0v8.219c.517.162 1.02.382 1.5.659V3.375a1.125 1.125 0 0 1 2.25 0v10.937a4.505 4.505 0 0 0-3.25 2.373 8.963 8.963 0 0 1 4-.935A.75.75 0 0 0 18 15v-2.266a3.368 3.368 0 0 1 .988-2.37 1.125 1.125 0 0 1 1.591 1.59 1.118 1.118 0 0 0-.329.79v3.006h-.005a6 6 0 0 1-1.752 4.007l-1.736 1.736a6 6 0 0 1-4.242 1.757H10.5a7.5 7.5 0 0 1-7.5-7.5V6.375a1.125 1.125 0 0 1 2.25 0v5.519c.46-.452.965-.832 1.5-1.141V3.375a1.125 1.125 0 0 1 2.25 0v6.526c.495-.1.997-.151 1.5-.151V1.875Z" />
		</svg>
	);
};
