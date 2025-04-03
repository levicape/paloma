import { clsx } from "clsx";
import {
	type FC,
	type PropsWithChildren,
	useCallback,
	useContext,
} from "hono/jsx";
import { useFormatMessage } from "../../../atoms/localization/I18nAtom";
import { Button } from "../../daisy/action/Button";
import {
	HeaderMenuOpenContextExport,
	HeaderSettingsOpenContextExport,
} from "./HeaderContext";

const HeaderMenuOpenContext = HeaderMenuOpenContextExport();
const HeaderSettingsOpenContext = HeaderSettingsOpenContextExport();
export const HeaderSettingsButton: FC<
	PropsWithChildren<{
		className: string;
		requestPath?: string;
	}>
> = ({ children, className, requestPath }) => {
	const formatMessage = useFormatMessage();
	const pathname =
		typeof window !== "undefined"
			? window.location?.pathname
			: (requestPath ?? "/");
	//   const { ready: authReady } = useStoreSelector(getAuthentication);
	const [menuOpen] = useContext(HeaderMenuOpenContext);
	const [, setHeaderSettingsOpen] = useContext(HeaderSettingsOpenContext);

	const isLoginScreen = pathname === "/;oidc/authorize";
	const hide = isLoginScreen || menuOpen; // || authReady !== true;

	const menuButtonOnClick = useCallback(() => {
		setHeaderSettingsOpen();
	}, [setHeaderSettingsOpen]);

	return (
		<Button
			aria-label={formatMessage({
				id: "ui.trim.header.settings.button.aria-label",
				defaultMessage: "Open Settings Menu",
				description: "aria-label for HeaderSettingsButton",
			})}
			className={clsx(hide ? "invisible" : undefined, className)}
			color={"neutral"}
			onClick={menuButtonOnClick}
			square
			role={"menubar"}
			variant={"ghost"}
		>
			{children}
		</Button>
	);
};
