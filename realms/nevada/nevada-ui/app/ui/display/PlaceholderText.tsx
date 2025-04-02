import { clsx } from "clsx";
import type { FC, PropsWithChildren } from "hono/jsx";

export type PlaceholderTextProps = {
	block?: boolean;
};

export const PlaceholderText: FC<PropsWithChildren<PlaceholderTextProps>> = ({
	children,
	block,
}) => {
	return (
		<span
			className={clsx(
				"animate-pulse",
				"cursor-default",
				"select-none",
				"rounded-sm",
				"bg-gray-100/10",
				"text-transparent",
				block ? "block" : undefined,
			)}
		>
			{children}
		</span>
	);
};
