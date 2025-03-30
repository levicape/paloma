import { clsx } from "clsx";
import { useFormatMessage } from "../../../atoms/localization/I18nAtom";
import { Loading } from "../../../ui/daisy/feedback/Loading";
import { ShieldCheckmark_Icon } from "../../../ui/display/icons/ShieldCheckmark";
import { DiscordLogo_Icon } from "../../../ui/display/icons/logos/DiscordLogo";

export const AuthorizeProgress = () => {
	const { enabled: discordEnabled } = {} as Record<string, unknown>; //useDiscord();

	const formatMessage = useFormatMessage();
	return !discordEnabled ? (
		<>
			<div className={clsx("flex", "justify-center", "items-center")}>
				<Loading
					variant={"ring"}
					className={clsx(
						"bg-clip-content",
						"stroke-accent",
						"fill-primary",
						"text-accent-content",
						"blur-2xl",
						"w-14",
						"animate-[loader]",
						"duration-500",
						"delay-700",
						"ease-out",
					)}
					size={"xl"}
				/>
				<Loading
					variant={"ring"}
					color={"accent"}
					className={clsx(
						"bg-clip-content",
						"stroke-accent",
						"fill-primary",
						"text-accent-content",
						"blur-2xl",
						"w-27",
						"animate-[loader]",
						"opacity-20",
						"transform-gpu",
						"translate-3d",
						"fixed",
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
					)}
					size={"xl"}
				/>
			</div>
			<div className={clsx("pt-4", "animate-pulse", "min-h-12", "min-w-8")}>
				{formatMessage({
					id: "oidc.authorize.login.alert",
					description: "Login in progress",
					defaultMessage: "Signing in",
				})}
			</div>
			<style>{`
@keyframes loader {
  75%, 100% {
    transform: scale(2);
    opacity: 0;
}
			`}</style>
		</>
	) : (
		<div className={clsx("flex", "items-center")}>
			<div>
				<DiscordLogo_Icon
					className={clsx(
						"h-16 w-16 rounded-full",
						"border-b-2",
						"border-t-2",
						"border-double",
						"border-[#5865f2]",
					)}
				/>
			</div>
			<div
				className={clsx(
					"outline-b-2",
					"outline-t-2",
					"outline-x-8",
					"outline-opacity-80",
					"h-16",
					"w-16",
					"translate-x-64",
					"rounded-full",
					"outline-cyan-300",
					"hover:border-white",
					"animate-pulse",
				)}
			>
				<ShieldCheckmark_Icon />
			</div>
			<div
				className={clsx(
					"h-16",
					"w-16",
					"translate-x-[-4em]",
					"animate-ping",
					"rounded-full",
					"border-b-2",
					"border-t-2",
					"border-stone-200",
					"delay-75",
					"duration-300",
				)}
			/>
			<div
				className={clsx(
					"h-14",
					"w-16",
					"translate-x-[-4.2em]",
					"animate-ping",
					"rounded-full",
					"border-b-2",
					"border-t-2",
					"border-gray-300",
					"delay-100",
					"duration-500",
				)}
			/>
			<div
				className={clsx(
					"h-12",
					"w-14",
					"translate-x-[-4.4em]",
					"animate-ping",
					"rounded-full",
					"border-x-4",
					"border-b-2",
					"border-t-2",
					"border-white",
					"border-x-green-500",
					"duration-1000",
				)}
			/>
			<div
				className={clsx(
					"h-12",
					"w-12",
					"translate-x-[-4.6em]",
					"animate-ping",
					"rounded-full",
					"border-b-2",
					"border-t-2",
					"border-slate-200",
					"delay-150",
					"duration-700",
				)}
			/>
			<div
				className={clsx(
					"h-10",
					"w-10",
					"translate-x-[-4.8em]",
					"animate-ping",
					"rounded-full",
					"border-b-2",
					"border-t-2",
					"border-stone-100",
					"delay-200",
					"duration-200",
				)}
			/>
		</div>
	);
};
