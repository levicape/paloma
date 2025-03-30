import { useMemo } from "react";
import { useOidcClient } from "../OidcClientAtom";

export const AuthnSession = () => {
	const { oidc, user } = useOidcClient();
	const style: React.CSSProperties = useMemo(
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
			...(user?.expired
				? { "data-session-expired": JSON.stringify(user.expired) }
				: {}),
			...(user?.expires_at
				? { "data-session-expires-at": JSON.stringify(user.expires_at) }
				: {}),
			...(user?.expires_in
				? { "data-session-expires-in": JSON.stringify(user.expires_in) }
				: {}),
			...(user?.scopes
				? { "data-session-scopes": JSON.stringify(user.scopes) }
				: {}),
			...(user?.profile
				? {
						"data-session-profile": JSON.stringify(user.profile),
					}
				: {}),
			...(user?.state
				? {
						"data-session-state": JSON.stringify(user.state),
					}
				: {}),
			...(user?.access_token
				? {
						"data-session-access-token": JSON.stringify(user.access_token),
					}
				: {}),
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
