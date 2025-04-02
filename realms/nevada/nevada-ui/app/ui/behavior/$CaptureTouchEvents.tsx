import {
	type CSSProperties,
	type FC,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "hono/jsx";

/**
 * Capture touch events to prevent default behavior.
 * @kind Island
 */
export const CaptureTouchEvents: FC = () => {
	const [mounted, setMounted] = useState(false);
	const noop = useCallback(() => {}, []);
	useEffect(() => {
		if (
			typeof document !== "undefined" &&
			document?.addEventListener !== undefined
		) {
			document.addEventListener("touchstart", noop);
			setMounted(true);
		}

		return () => {
			setMounted(false);
			if (
				typeof document !== "undefined" &&
				document?.removeEventListener !== undefined
			) {
				document.removeEventListener("touchstart", noop);
			}
		};
	}, [noop]);

	const style: CSSProperties = useMemo(
		() => ({
			display: "none",
			pointerEvents: "none",
			touchAction: "none",
			position: "fixed",
			visibility: "hidden",
			width: 0,
			height: 0,
			top: 0,
			left: 0,
			zIndex: -1,
		}),
		[],
	);

	return (
		<object
			aria-hidden
			style={style}
			typeof="CaptureTouchEvents"
			data-mounted={String(mounted)}
			suppressHydrationWarning
		/>
	);
};
