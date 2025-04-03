import clsx from "clsx";
import type { Context } from "hono";
import { ErrorBoundary, Suspense, useMemo } from "hono/jsx";
import { Fragment } from "hono/jsx/jsx-runtime";
import { serializeError } from "serialize-error";
import { useOidcClient } from "../../atoms/authentication/OidcClientAtom";
import { useFormatMessage } from "../../atoms/localization/I18nAtom";
import { Button } from "../../ui/daisy/action/Button";
import { Alert } from "../../ui/daisy/feedback/Alert";
import { Loading } from "../../ui/daisy/feedback/Loading";
import { NevadaLs, get__ } from "./$NevadaLs";

export default function Nevada(_c: Context) {
	const formatMessage = useFormatMessage();
	const url =
		typeof location !== "undefined" ? new URL(location.href) : undefined;
	const { userReady, oidcFetch } = useOidcClient();
	const get = useMemo(
		() => get__({ userReady, oidcFetch }),
		[userReady, oidcFetch],
	);
	return (
		<main>
			<Fragment>
				<h2
					className={clsx(
						"font-bold",
						"text-2xl",
						"flex",
						"pt-4",
						"pb-4",
						"bg-neutral-300/12",
						"bg-blend-soft-light",
					)}
					suppressHydrationWarning
				>
					{url ? `Nevada @ ${url.toString()}` : "Nevada"}
				</h2>
				<article
					className={clsx(
						"card",
						"border-1",
						"rounded-lg",
						"p-1",
						"border-info/80",
						"border-double",
						"bg-neutral/20",
						"bg-blend-soft-light",
						"min-h-24",
						"min-w-16",
					)}
				>
					<header className={clsx("card-title")}>
						<h3>List dir</h3>
						<ErrorBoundary
							fallbackRender={(error) => {
								const stack = error?.stack;
								if (error instanceof Error) {
									error.stack = undefined;
								}
								return (
									<Fragment>
										<Alert
											className={clsx("text-error-content", "-py-2")}
											color={"error"}
										>
											<h3
												className={clsx("font-bold", "text-md", "md:text-lg")}
											>
												{formatMessage({
													id: "atlas.$MagmapAtlas.error.title",
													defaultMessage: "Error loading",
													description: "Error boundary heading",
												})}
											</h3>
											<p className={clsx("hidden", "md:block")}>
												{formatMessage({
													id: "atlas.$MagmapAtlas.error.content",
													defaultMessage: "Could not fetch",
												})}
											</p>
											<div className={clsx("size-1", "invisible")} />
											<Button color={"error"} variant={"link"}>
												{formatMessage({
													id: "atlas.$MagmapAtlas.error.refresh",
													defaultMessage: "Refresh",
												})}
											</Button>
										</Alert>

										<details className={clsx("w-full")}>
											<summary className={clsx("text-sm")}>
												{formatMessage({
													id: "atlas.$MagmapAtlas.error.summary",
													defaultMessage: "Click to view details",
												})}
											</summary>
											<textarea
												contentEditable={false}
												className={clsx(
													"ml-2",
													"w-11/12",
													"bg-gray-950",
													"text-gray-50",
													"border-b-1",
													"border-x-1",
													"border-error/30",
													"border-s",
													"shadow-xs",
													"pt-2",
													"pb-2.5",
													"pr-1.5",
													"pl-0.5",
													"m-w-54",
													"whitespace-pre-wrap",
													"text-md",
													"font-mono",
													"min-h-8",
												)}
											>
												{JSON.stringify(serializeError(error), null, 4)}
											</textarea>
											{stack ? (
												<textarea
													contentEditable={false}
													className={clsx(
														"block",
														"text-end",
														"mt-3.5",
														"ml-2",
														"w-11/12",
														"bg-gray-200/80",
														"bg-blend-color-burn",
														"text-error",
														"border-t-1",
														"border-x-2",
														"border-accent/20",
														"shadow-md",
														"pt-1",
														"pb-2",
														"pr-1",
														"pl-0.5",
														"m-w-54",
														"whitespace-pre-wrap",
														"text-md",
														"font-mono",
														"min-h-14",
													)}
												>
													{stack}
												</textarea>
											) : (
												<></>
											)}
										</details>
									</Fragment>
								);
							}}
						>
							<Suspense
								fallback={
									<section
										className={clsx([
											"card-body",
											"min-w-64",
											"min-h-12",
											"flex",
											"flex-col",
											"gap-4",
											"items-center",
											"justify-center",
											"bg-neutral-300/12",
											"bg-blend-soft-light",
										])}
									>
										<span
											className={clsx(
												"font-bold",
												"text-lg",
												"text-accent-content",
												"animate-pulse",
											)}
										>
											{formatMessage({
												id: "nevada.loading",
												defaultMessage: "Loading",
												description: "Loading",
											})}
										</span>
										<Loading
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
											variant="dots"
											size="lg"
										/>
									</section>
								}
							>
								<NevadaLs get={get} />
							</Suspense>
						</ErrorBoundary>
					</header>
				</article>
			</Fragment>
		</main>
	);
}
