// import type { MagmapHonoApp } from "@levicape/pal-io/http/HonoApp";
// import clsx from "clsx";
// import { destr } from "destr";
// import { hc } from "hono/client";
// import { Suspense, useCallback, useEffect, useMemo, useState } from "hono/jsx";
// import { ErrorBoundary } from "react-error-boundary";
// import { Await } from "react-router";
// import { deserializeError, serializeError } from "serialize-error";
// import {
// 	type OidcFetch,
// 	useOidcClient,
// } from "../../atoms/authentication/OidcClientAtom";
// import { useFormatMessage } from "../../atoms/localization/I18nAtom";
// import { Button } from "../../ui/daisy/action/Button";
// import { Alert } from "../../ui/daisy/feedback/Alert";
// import { Loading } from "../../ui/daisy/feedback/Loading";

// declare global {
// 	interface Window {
// 		"--magmap-revalidate"?: () => void;
// 		"--magmap-debug"?: boolean;
// 	}
// }

// const windowLocation = typeof location !== "undefined" ? location.origin : "";
// const Magmap = hc<MagmapHonoApp>(windowLocation);
// const GetMagmapAtlasfile = async (userReady: boolean, oidcFetch: OidcFetch) => {
// 	const debugEnabled =
// 		typeof window !== "undefined" ? window["--magmap-debug"] : undefined;

// 	if (!userReady) {
// 		await new Promise(() => {});
// 	}

// 	let url: URL | undefined;
// 	try {
// 		url = Magmap["~"].Spork.Magmap.atlas.$url();
// 		const atlasfiles = await Magmap["~"].Spork.Magmap.atlas.$get(
// 			{},
// 			{
// 				fetch: oidcFetch,
// 			},
// 		);
// 		let response = (await atlasfiles.text()) as unknown as Awaited<
// 			ReturnType<(typeof atlasfiles)["json"]>
// 		>;
// 		debugEnabled &&
// 			console.log({
// 				MagmapRoutemap: {
// 					atlasfiles: atlasfiles.status,
// 					response,
// 				},
// 			});

// 		if (typeof response === "string") {
// 			response = destr(response);
// 		}

// 		const maybeError = (response as { error?: unknown }).error;
// 		const isErrorStatus = atlasfiles.status > 401;
// 		if (isErrorStatus || maybeError !== undefined) {
// 			throw {
// 				FetchError: {
// 					message: `Response ${atlasfiles.status}: ${atlasfiles.statusText}`,
// 					url,
// 					response,
// 					error: maybeError,
// 				},
// 			};
// 		}

// 		if (atlasfiles.status === 401) {
// 			throw {
// 				Unauthorized: {
// 					message: `Unauthorized ${atlasfiles.status} ${atlasfiles.statusText}`,
// 					url,
// 					response,
// 				},
// 			};
// 		}

// 		return response as typeof response & { error?: never };
// 	} catch (error) {
// 		const message = `Fetching ${url}`;
// 		console.warn({
// 			MagmapRoutemap: {
// 				message,
// 				error: serializeError(error),
// 			},
// 		});

// 		throw new Error(message, { cause: deserializeError(error) });
// 	}
// };

// // type MagmapAtlasfile = Awaited<ReturnType<typeof GetMagmapAtlasfile>>;
// export const MagmapAtlas = () => {
// 	const formatMessage = useFormatMessage();
// 	const { userReady, oidcFetch } = useOidcClient();
// 	const [active, setActive] = useState(true);
// 	const revalidate = useCallback(() => {
// 		setActive(() => false);
// 		setTimeout(() => {
// 			setActive(() => true);
// 		}, 39);
// 	}, []);

// 	const fetchPromise = useMemo(async () => {
// 		return Promise.resolve(active).then(() =>
// 			GetMagmapAtlasfile(userReady, oidcFetch),
// 		);
// 	}, [active, userReady, oidcFetch]);

// 	const [url, setUrl] = useState("");

// 	useEffect(() => {
// 		window["--magmap-revalidate"] = () => {
// 			revalidate();
// 		};

// 		return () => {
// 			window["--magmap-revalidate"] = undefined;
// 		};
// 	}, [revalidate]);

// 	useEffect(() => {
// 		setUrl(location.href);
// 	}, []);

// 	return (
// 		<>
// 			<h2
// 				className={clsx(
// 					"font-bold",
// 					"text-2xl",
// 					"flex",
// 					"pt-4",
// 					"pb-4",
// 					"bg-neutral-300/12",
// 					"bg-blend-soft-light",
// 				)}
// 				suppressHydrationWarning
// 			>
// 				Atlasfile @ {url.toString()}
// 			</h2>
// 			<article
// 				className={clsx(
// 					"card",
// 					"border-1",
// 					"rounded-lg",
// 					"p-1",
// 					"border-info/80",
// 					"border-double",
// 					"bg-neutral/20",
// 					"bg-blend-soft-light",
// 					"min-h-24",
// 					"min-w-16",
// 				)}
// 			>
// 				<header className={clsx("card-title")}>
// 					<h3>AtlasRoutes</h3>
// 				</header>
// 				<pre className="overflow-x-auto card-body">
// 					<Suspense
// 						fallback={
// 							<section
// 								className={clsx([
// 									"card-body",
// 									"min-w-64",
// 									"min-h-12",
// 									"flex",
// 									"flex-col",
// 									"gap-4",
// 									"items-center",
// 									"justify-center",
// 									"bg-neutral-300/12",
// 									"bg-blend-soft-light",
// 								])}
// 							>
// 								<span
// 									className={clsx(
// 										"font-bold",
// 										"text-lg",
// 										"text-accent-content",
// 										"animate-pulse",
// 									)}
// 								>
// 									{formatMessage({
// 										id: "atlas.$MagmapAtlas.loading",
// 										defaultMessage: "Loading",
// 										description: "Loading Atlas",
// 									})}
// 								</span>
// 								<Loading
// 									className={clsx(
// 										"bg-clip-content",
// 										"stroke-accent",
// 										"fill-primary",
// 										"text-accent-content",
// 										"blur-2xl",
// 										"w-14",
// 										"animate-[loader]",
// 										"duration-500",
// 										"delay-700",
// 										"ease-out",
// 									)}
// 									variant="dots"
// 									size="lg"
// 								/>
// 							</section>
// 						}
// 					>
// 						<ErrorBoundary
// 							FallbackComponent={({ error, resetErrorBoundary }) => {
// 								const stack = error?.stack;
// 								if (error instanceof Error) {
// 									error.stack = undefined;
// 								}
// 								return (
// 									<>
// 										<Alert
// 											className={clsx("text-error-content", "py-[-2]")}
// 											color={"error"}
// 										>
// 											<h3
// 												className={clsx("font-bold", "text-md", "md:text-lg")}
// 											>
// 												{formatMessage({
// 													id: "atlas.$MagmapAtlas.error.title",
// 													defaultMessage: "Error loading atlasfile",
// 													description: "$MagmapAtlas: Error boundary heading",
// 												})}
// 											</h3>
// 											<p className={clsx("hidden", "md:block")}>
// 												{formatMessage({
// 													id: "atlas.$MagmapAtlas.error.content",
// 													defaultMessage: "Could not fetch atlasfile.",
// 												})}
// 											</p>
// 											<div className={clsx("size-1", "invisible")} />
// 											<Button
// 												onClick={resetErrorBoundary}
// 												color={"error"}
// 												variant={"link"}
// 											>
// 												{formatMessage({
// 													id: "atlas.$MagmapAtlas.error.refresh",
// 													defaultMessage: "Refresh",
// 												})}
// 											</Button>
// 										</Alert>

// 										<details className={clsx("w-full")}>
// 											<summary className={clsx("text-sm")}>
// 												{formatMessage({
// 													id: "atlas.$MagmapAtlas.error.summary",
// 													defaultMessage: "Click to view details",
// 												})}
// 											</summary>
// 											<textarea
// 												contentEditable={false}
// 												className={clsx(
// 													"ml-2",
// 													"w-11/12",
// 													"bg-gray-950",
// 													"text-gray-50",
// 													"border-b-1",
// 													"border-x-1",
// 													"border-error/30",
// 													"border-s",
// 													"shadow-xs",
// 													"pt-2",
// 													"pb-2.5",
// 													"pr-1.5",
// 													"pl-0.5",
// 													"m-w-54",
// 													"whitespace-pre-wrap",
// 													"text-md",
// 													"font-mono",
// 													"min-h-8",
// 												)}
// 											>
// 												{JSON.stringify(serializeError(error), null, 4)}
// 											</textarea>
// 											{stack ? (
// 												<textarea
// 													contentEditable={false}
// 													className={clsx(
// 														"block",
// 														"text-end",
// 														"mt-3.5",
// 														"ml-2",
// 														"w-11/12",
// 														"bg-gray-200/80",
// 														"bg-blend-color-burn",
// 														"text-error",
// 														"border-t-1",
// 														"border-x-2",
// 														"border-accent/20",
// 														"shadow-md",
// 														"pt-1",
// 														"pb-2",
// 														"pr-1",
// 														"pl-0.5",
// 														"m-w-54",
// 														"whitespace-pre-wrap",
// 														"text-md",
// 														"font-mono",
// 														"min-h-14",
// 													)}
// 												>
// 													{stack}
// 												</textarea>
// 											) : (
// 												<></>
// 											)}
// 										</details>
// 									</>
// 								);
// 							}}
// 							onReset={revalidate}
// 						>
// 							{active ? (
// 								<Await resolve={fetchPromise}>
// 									{(response) => {
// 										if (!response) {
// 											return <></>;
// 										}

// 										const { data } = response;
// 										return JSON.stringify(data ?? {}, null, 2);
// 									}}
// 								</Await>
// 							) : (
// 								<></>
// 							)}
// 						</ErrorBoundary>
// 					</Suspense>
// 				</pre>
// 			</article>
// 		</>
// 	);
// };
