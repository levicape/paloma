import { type CSSProperties, useMemo } from "react";
import { useOidcClient } from "../OidcClientAtom";

export const AuthnSession = () => {
	const { oidc, user } = useOidcClient();
	// const { enabled: discordEnabled } = {} as Record<string, unknown>; //useDiscord();

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

	const dataAttributes = useMemo(
		() => ({
			"data-oidc": oidc !== null ? "true" : "false",
			"data-session-expired": user?.expired ? JSON.stringify(user.expired) : "",
			"data-session-expires-at": user?.expires_at
				? JSON.stringify(user.expires_at)
				: "",
			"data-session-expires-in": user?.expires_in
				? JSON.stringify(user.expires_in)
				: "",
			"data-session-state": user?.state ? JSON.stringify(user.state) : "",
		}),
		[oidc, user],
	);

	return (
		<object
			aria-hidden
			style={style}
			typeof={"AuthnSession"}
			suppressHydrationWarning
			{...dataAttributes}
		/>
	);
};
