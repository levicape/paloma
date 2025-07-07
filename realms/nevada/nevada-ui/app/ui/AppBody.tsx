import { clsx } from "clsx";
import {
	ErrorBoundary,
	type FC,
	type PropsWithChildren,
	useMemo,
} from "hono/jsx";
import { AuthnSession } from "../atoms/authentication/behavior/$AuthnSession";
import { BackgroundBody } from "../variant/BackgroundBody";
import { DesignSystem } from "./DesignSystem";
import { CaptureTouchEvents } from "./behavior/$CaptureTouchEvents";
import { Skeleton } from "./daisy/feedback/Skeleton";
import { HeaderLayout } from "./trim/header/HeaderLayout";

const { Shell, ContentLayout, Fallback, Footer } = DesignSystem;
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
				<ErrorBoundary fallback={<Fallback />}>
					<ContentLayout>{children}</ContentLayout>
				</ErrorBoundary>
			</HeaderLayout>
			<Footer />
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
