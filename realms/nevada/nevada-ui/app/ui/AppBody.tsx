import { clsx } from "clsx";
import { type FC, type PropsWithChildren, Suspense, useMemo } from "react";
import { AuthnSession } from "../atoms/authentication/behavior/$AuthnSession";
import { BackgroundBody } from "../variant/BackgroundBody";
import { DesignSystem } from "./DesignSystem";
import { CaptureTouchEvents } from "./behavior/$CaptureTouchEvents";
import { Skeleton } from "./daisy/feedback/Skeleton";
import { HeaderLayout } from "./trim/header/HeaderLayout";

const { Shell, Layout, Fallback } = DesignSystem;
const { SoftLight } = BackgroundBody;

export const AppBody: FC<PropsWithChildren> = ({ children }) => (
	<body id="app">
		<Shell>
			<SoftLight />
			<HeaderLayout
				vars={useMemo(
					() => ({
						appHeight: "--app-height",
					}),
					[],
				)}
			>
				<Suspense fallback={<Fallback />}>
					<Layout>{children}</Layout>
				</Suspense>
			</HeaderLayout>
		</Shell>
		<Skeleton
			className={clsx(
				"h-2.5",
				"opacity-0",
				"-translate-y-1.5",
				"transform-gpu",
				"translate-3d",
				"backface-hidden",
				"scale-y-200",
				"will-change-[opacity,transform,translate]",
				"transition-all",
				"duration-[10s]",
			)}
		/>

		<CaptureTouchEvents />
		<AuthnSession />
	</body>
);
