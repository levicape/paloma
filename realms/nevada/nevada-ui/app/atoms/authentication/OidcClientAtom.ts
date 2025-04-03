import { useCallback, useEffect, useMemo, useState } from "hono/jsx";
import { useAtom } from "jotai/react";
import { atom } from "jotai/vanilla";
import {
	type OidcClient,
	type User,
	UserManager,
	WebStorageStateStore,
} from "oidc-client-ts";

export type OauthClientAtomState = {
	oidcClient: OidcClient | null;
	userManager: UserManager | null;
};

export const OidcClientAtomSymbol = Symbol.for("OIDC_CLIENT_ATOM");

declare global {
	interface Window {
		"--oidc-debug"?: boolean;
		"~oidc":
			| {
					OAUTH_PUBLIC_OIDC_AUTHORITY: string;
					OAUTH_PUBLIC_OIDC_CLIENT_ID: string;
					OAUTH_PUBLIC_OIDC_REDIRECT_URI: string;
					OAUTH_PUBLIC_OIDC_POST_LOGOUT_REDIRECT_URI: string;
					OAUTH_PUBLIC_OIDC_SILENT_REDIRECT_URI: string;
			  }
			| undefined;
		"~oidc_usermanager":
			| {
					revalidate: boolean;
					userManager: UserManager;
			  }
			| undefined;
	}
}

const initializeOidcClient = () => {
	if (typeof window !== "undefined") {
		if (window["~oidc"]) {
			const debugEnabled = window["--oidc-debug"];
			if (window["~oidc_usermanager"]?.userManager) {
				if (window?.["~oidc_usermanager"]?.revalidate !== true) {
					debugEnabled &&
						console.debug({
							OidcClientAtom: {
								message: "OIDC client found in window",
								window: window["~oidc"],
							},
						});
					return window["~oidc_usermanager"];
				}
			}

			debugEnabled &&
				console.debug({
					OidcClientAtom: {
						message: "OIDC client initializing",
						window: window["~oidc"],
					},
				});
			const {
				OAUTH_PUBLIC_OIDC_AUTHORITY,
				OAUTH_PUBLIC_OIDC_CLIENT_ID,
				OAUTH_PUBLIC_OIDC_REDIRECT_URI,
				OAUTH_PUBLIC_OIDC_POST_LOGOUT_REDIRECT_URI,
				OAUTH_PUBLIC_OIDC_SILENT_REDIRECT_URI,
			} = window["~oidc"];

			const userManager = new UserManager({
				authority: OAUTH_PUBLIC_OIDC_AUTHORITY,
				client_id: OAUTH_PUBLIC_OIDC_CLIENT_ID,
				redirect_uri: OAUTH_PUBLIC_OIDC_REDIRECT_URI,
				post_logout_redirect_uri: OAUTH_PUBLIC_OIDC_POST_LOGOUT_REDIRECT_URI,
				silent_redirect_uri: OAUTH_PUBLIC_OIDC_SILENT_REDIRECT_URI,
				response_type: "code",
				scope: "openid profile email",
				automaticSilentRenew: false,
				accessTokenExpiringNotificationTimeInSeconds: 66,
				stateStore: new WebStorageStateStore({
					prefix: "oidc.user.manager",
					store: window.localStorage,
				}),
			});

			const windowObj = {
				userManager,
				revalidate: false,
			};
			if (typeof window !== "undefined") {
				window["~oidc_usermanager"] = windowObj;
			}

			return windowObj;
		}
	} else {
		console.warn({
			OidcClientAtom: {
				message: "OIDC client not initialized",
			},
		});
	}
	return null;
};

const client = initializeOidcClient();
export const OidcClientAtom = atom(client);
export const OidcUserAtom = atom<User | null | undefined>(undefined);
export type OidcFetch = typeof fetch;
export type OidcUser = User | null | undefined;

export const DEFAULT_TRAILING_PREFIXES = ["/~/", "/!/"];

const windowFetch = fetch;
export interface UseOidcClientProps {
	/**
	 * If a Request starts with any string in `trailingSlashFilter`,
	 * the returned fetch client (`oidcFetch`) will attach a trailing slash
	 * at the end of the pathname only if it is not already included in the URL
	 */
	trailingSlashFilter?: Array<string>;
}
export type UseOidcClientFetchUserStateProps = {
	/**
	 *  Always fetch User state, regardless of if the user is already loaded.
	 *  Do not use with useEffect, as it may performance implications
	 */
	refresh: boolean;
};

export interface UseOidcClientState {
	/**
	 * The OIDC client instance from oidc-client-ts
	 */
	oidc: typeof client;
	/**
	 * The user object from oidc-client-ts
	 */
	user: OidcUser;
	/**
	 * The fetch client that will automatically attach the access token to the request
	 * if the user is authenticated
	 */
	oidcFetch: OidcFetch;
	/**
	 * Whether the user is authenticated and the access token is valid. Will be set to null if user is still loading
	 */
	userReady: boolean | null;
	/**
	 * Fetch the user state from the OIDC client
	 */
	fetchUserState: (props?: UseOidcClientFetchUserStateProps) => void;
}

const EMPTY: Record<string, unknown> = {};

export const useOidcClient = (props?: UseOidcClientProps) => {
	const { trailingSlashFilter } = props ?? EMPTY;
	const [oidc] = useAtom(OidcClientAtom);
	const [user, setUser] = useAtom(OidcUserAtom);
	const { enabled: discordEnabled } = EMPTY;

	const oidcFetch = useMemo(() => {
		const authenticatedFetch: OidcFetch = async (
			input: Parameters<OidcFetch>[0],
			init?: Parameters<OidcFetch>[1],
		) => {
			let url: typeof input | undefined;
			if (Array.isArray(trailingSlashFilter) && !(input instanceof Request)) {
				const notrequest = new URL(input);
				const { pathname } = notrequest;
				if (trailingSlashFilter.some((prefix) => pathname.startsWith(prefix))) {
					if (!pathname.endsWith("/")) {
						url = `${pathname}/`;
					}
				}
			}

			if (url === undefined) {
				url = input;
			}

			if (oidc && user) {
				const token = user;
				if (token?.access_token) {
					return windowFetch(url, {
						...init,
						headers: {
							...(init?.headers ?? {}),
							...(user
								? { authorization: `Bearer ${token.access_token}` }
								: {}),
						},
					});
				}
			}

			return windowFetch(url, init);
		};

		return authenticatedFetch;
	}, [oidc, user]);

	const [ready, setReady] = useState(false);
	const fetchUserState: UseOidcClientState["fetchUserState"] = useCallback(
		(props) => {
			const { refresh } = { refresh: false, ...(props ?? {}) };

			if (!discordEnabled) {
				if (refresh || user === null || user === undefined) {
					return (async () => {
						const debugEnabled = window["--oidc-debug"];
						let sessionUser: User | null | undefined;
						let sessionError: unknown;
						try {
							sessionUser = await oidc?.userManager.getUser();
							setUser(sessionUser);
						} catch (error) {
							sessionError = error;
						}

						debugEnabled &&
							console.debug({
								OidcClientAtom: {
									sessionUser: {
										...sessionUser,
										access_token: undefined,
										id_token: undefined,
										refresh_token: undefined,
										token_type: undefined,
									},
									sessionError,
								},
							});

						if (sessionError) {
							throw sessionError;
						}

						if (!sessionUser?.expired) {
							setReady(true);
						}

						return sessionUser;
					})().then((user) => user);
				}
				if (ready === false) {
					setReady(true);
				}
				return Promise.resolve(user);
			}
		},
		[oidc, discordEnabled, user, setUser, ready, setReady],
	);
	const userReady = useMemo(() => {
		if (!ready) {
			return null;
		}

		return (
			user?.expired === false &&
			user?.access_token !== undefined &&
			oidcFetch !== windowFetch
		);
	}, [user?.expired, user?.access_token, oidcFetch, ready]);

	useEffect(() => {
		fetchUserState({ refresh: false });
	}, [fetchUserState]);

	return useMemo(() => {
		return {
			oidc,
			user,
			userReady,
			oidcFetch,
			fetchUserState,
		};
	}, [oidc, user, userReady, oidcFetch, fetchUserState]);
};
