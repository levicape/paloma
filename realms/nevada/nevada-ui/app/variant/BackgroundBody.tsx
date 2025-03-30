import { clsx } from "clsx";

export namespace BackgroundBody {
	export const SoftLight = () => (
		<div
			aria-hidden
			className={clsx(
				"absolute",
				"w-full",
				"h-full",
				"opacity-15",
				"bg-neutral/10",
				"bg-gradient-to-b",
				"to-accent/25",
			)}
		>
			<div
				aria-hidden
				className={clsx(
					"w-full",
					"h-full",
					"translate-3d",
					"transform-gpu",
					"blur-xl",
					"bg-primary/15",
					"bg-gradient-to-t",
					"to-neutral/70",
					"dark:mix-blend-color-dodge",
					"light:mix-blend-color-burn",
				)}
			/>
			<style>{`
							@media (prefers-color-scheme:light) {
								.background-body {
									background-image: url("/-decor/crossword.png");
								}			
							}
				
							@media (prefers-color-scheme:dark) {
								.background-body {
									background-image: url("/-decor/twinkle_twinkle.png");
								}			
							}`}</style>
		</div>
	);
}
