import { clsx } from "clsx";

export namespace BackgroundBody {
	export const SoftLight = () => (
		<div
			aria-hidden
			className={clsx(
				"float-start",
				"isolate",
				"w-full",
				"h-full",
				"bg-neutral/10",
				"bg-gradient-to-b",
				"to-secondary/5",
				"z-[5]",
			)}
		>
			<div
				aria-hidden
				className={clsx(
					"absolute",
					"w-full",
					"h-full",
					"translate-3d",
					"transform-gpu",
					"bg-primary/15",
					"bg-gradient-to-t",
					"to-neutral/50",
					"opacity-20",
					"animate-[pulse_20s_cubic-bezier(0.4,0,0.6,1)_infinite]",
					"z-[5]",
				)}
			/>
			<div
				aria-hidden
				className={clsx(
					"absolute",
					"w-full",
					"h-full",
					"translate-3d",
					"transform-gpu",
					"bg-accent/40",
					"bg-gradient-to-b",
					"to-primary/15",
					"opacity-5",
					"z-[5]",
					// isLoading
					// "animate-bounce"
				)}
			/>
			<div
				aria-hidden
				className={clsx(
					"absolute",
					"w-full",
					"h-full",
					"translate-3d",
					"transform-gpu",
					"bg-accent/60",
					"bg-gradient-to-r",
					"to-primary/60",
					"animate-[spin_10s_ease-in_infinite]",
					"opacity-10",
					"z-[5]",
				)}
			/>
			<div
				aria-hidden
				className={clsx(
					"absolute",
					"w-full",
					"h-full",
					"translate-3d",
					"transform-gpu",
					"bg-secondary/35",
					"bg-radial",
					"to-accent/10",
					"opacity-20",
					"z-[5]",
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
