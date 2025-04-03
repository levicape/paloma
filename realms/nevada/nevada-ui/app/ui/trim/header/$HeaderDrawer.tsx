import { clsx } from "clsx";
import {
	type FC,
	type PropsWithChildren,
	useCallback,
	useEffect,
	useState,
} from "hono/jsx";
import { DesignSystem } from "../../DesignSystem";
import { Navbar } from "../../daisy/navigation/Navbar";
import { Bars4_Icon } from "../../display/icons/Bars4";
import { Cog_Icon } from "../../display/icons/Cog";
import { HeaderMenuButton } from "./$HeaderMenuButton";
import { HeaderMenuSidebar } from "./$HeaderMenuSidebar";
import { HeaderSettingsButton } from "./$HeaderSettingsButton";
import {
	HeaderMenuOpenContextExport,
	HeaderSettingsOpenContextExport,
} from "./HeaderContext";

const HeaderMenuOpenContext = HeaderMenuOpenContextExport();
const HeaderSettingsOpenContext = HeaderSettingsOpenContextExport();

export type HeaderDrawerProps = {
	requestPath?: string;
	vars: {
		appHeight: string;
	};
};

export const HeaderDrawer: FC<PropsWithChildren<HeaderDrawerProps>> = (
	props,
) => {
	const { children, vars, requestPath } = props;
	const pathname =
		typeof window !== "undefined"
			? window.location.pathname
			: (requestPath ?? "/");
	const [loading, setLoading] = useState<boolean>(true);
	const [menuOpen, setMenuOpen] = useState<boolean>(false);
	const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
	const [windowHeight, setWindowHeight] = useState<number | null>(null);

	const showOverlay = menuOpen || settingsOpen;

	const scrollToTop = useCallback(() => {
		if (window && typeof window.scrollTo === "function") {
			window.scrollTo(0, 1);
		}
	}, []);

	const menuOpenOnChange = useCallback(
		(value?: boolean) => {
			scrollToTop();
			setMenuOpen(value || !menuOpen);
			setSettingsOpen(false);
			setWindowHeight(menuOpen === false ? window.innerHeight : null);
		},
		[scrollToTop, menuOpen],
	);

	const settingsOpenOnChange = useCallback(
		(value?: boolean) => {
			scrollToTop();
			setSettingsOpen(value || !settingsOpen);
			setMenuOpen(false);
			setWindowHeight(settingsOpen === false ? window.innerHeight : null);
		},
		[scrollToTop, settingsOpen],
	);

	const closeModalOnClick = useCallback(
		(event: MouseEvent) => {
			if (showOverlay) {
				event.preventDefault();
				setMenuOpen(false);
				setSettingsOpen(false);
				setWindowHeight(null);
			}
		},
		[showOverlay],
	);

	const closeModalOnKeydown = useCallback(
		(event: KeyboardEvent) => {
			if (event.key === "Escape" && showOverlay) {
				event.preventDefault();
				setMenuOpen(false);
				setSettingsOpen(false);
				setWindowHeight(null);
			}
		},
		[showOverlay],
	);

	useEffect(() => {
		const update = () => {
			setLoading(false);
		};

		const immediate = setTimeout(update, 160);
		return () => {
			clearTimeout(immediate);
		};
	}, []);

	// TODO: Load this from context provided callback
	const isRoot = pathname === "/";
	if (isRoot || pathname.startsWith("/;")) {
		return <div className={clsx(isRoot ? "min-h-0.5" : "min-h-12")} />;
	}
	// const a = useAtomValue(AuthenticationAtom);
	return (
		<HeaderMenuOpenContext.Provider value={[menuOpen, menuOpenOnChange]}>
			<HeaderSettingsOpenContext.Provider
				value={[settingsOpen, settingsOpenOnChange]}
			>
				<HeaderMenuSidebar
					className={clsx(
						"duration-100",
						"delay-75",
						"ease-out",
						...(loading
							? ["opacity-0", "invisible"]
							: ["opacity-100", "visible"]),
						"will-change-[opacity,visibility]",
					)}
				/>
				<div
					suppressHydrationWarning
					className={clsx(
						"relative",
						"z-40",
						menuOpen ? "translate-x-64" : "translate-x-0",
						"transform-gpu",
						"transition-transform",
						"duration-100",
						"delay-75",
						"ease-linear",
						"will-change-[transform,translate]",
					)}
				>
					<Navbar
						role={"navigation"}
						background={"bg-base-200"}
						text={"text-base-content"}
						shadow={"shadow-sm"}
						className={clsx(
							"flex",
							"min-h-2.5",
							"bg-gradient-to-b",
							"to-base-300",
							"transition-all",
							"will-change-[blur,opacity]",
							"ease-in-out",
							"duration-100",
							"translate-3d",
							"transform-gpu",
							"backface-hidden",
							...(loading
								? clsx("opacity-80", "blur-sm")
								: clsx("opacity-100", "blur-none")),
						)}
						start={
							<HeaderMenuButton
								className={clsx(
									"p-1",
									menuOpen ? "opacity-0" : "opacity-100",
									"will-change-[opacity]",
									"transition-[opacity]",
									"duration-75",
									"ease-in",
								)}
							>
								<Bars4_Icon />
							</HeaderMenuButton>
						}
						center={
							<DesignSystem.Header
								className={clsx(
									menuOpen ? "opacity-0" : "opacity-100",
									"will-change-[opacity]",
									"transition-[opacity]",
									menuOpen ? "duration-75" : "duration-200",
									menuOpen ? "ease-in" : "ease-linear",
									menuOpen ? "delay-0" : "delay-150",
								)}
							>
								{children}
							</DesignSystem.Header>
						}
						end={
							<HeaderSettingsButton
								className={clsx("p-1", "md:block", "md:relative")}
							>
								<Cog_Icon />
							</HeaderSettingsButton>
						}
					/>
				</div>
				<div
					className={clsx(
						"fixed",
						"top-8",
						"left-0",
						"right-0",
						"bottom-0",
						"p-[-8]",
						"m-[-8]",
						"z-30",
						menuOpen ? "duration-0" : "duration-100",
						menuOpen ? "delay-75" : "delay-0",
						"ease-linear",
						"translate-3d",
						"transform-gpu",
						"will-change-[opacity,background-color]",
						"transition-[opacity,background-color]",
						showOverlay
							? clsx("pointer-events-auto", "bg-gray-900/80", "opacity-95")
							: clsx("pointer-events-none", "bg-gray-600", "opacity-0"),
					)}
					onClick={closeModalOnClick}
					onKeyDown={closeModalOnKeydown}
				/>
				<object
					aria-hidden
					className={clsx(
						"invisible",
						"top-0",
						"left-0",
						"w-0",
						"h-0",
						"pointer-events-none",
						"absolute",
						"z-[-1]",
						"touch-none",
						"hidden",
						"opacity-0",
					)}
					typeof={"HeaderDrawer"}
					data-pathname={pathname}
					suppressHydrationWarning
				/>
				<style>
					{`:root {
						${windowHeight ? `${vars.appHeight}: ${windowHeight - 5}px;` : ""}
					}`}
				</style>
			</HeaderSettingsOpenContext.Provider>
		</HeaderMenuOpenContext.Provider>
	);
};
