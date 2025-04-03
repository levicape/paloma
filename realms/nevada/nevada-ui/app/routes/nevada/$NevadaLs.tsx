import type { NevadaHonoApp } from "@levicape/paloma-nevada-io/http/HonoApp";
import clsx from "clsx";
import { destr } from "destr";
import { hc } from "hono/client";
import { use } from "hono/jsx";
import { deserializeError, serializeError } from "serialize-error";
import type { OidcFetch } from "../../atoms/authentication/OidcClientAtom";
// import { Button } from "../../ui/daisy/action/Button";
// import { Alert } from "../../ui/daisy/feedback/Alert";
// import { Loading } from "../../ui/daisy/feedback/Loading";

declare global {
	interface Window {
		"--nevada-revalidate"?: () => void;
		"--nevada-debug"?: boolean;
	}
}

const windowLocation = typeof location !== "undefined" ? location.origin : "";
const ServiceClient = hc<NevadaHonoApp>(windowLocation);
type GetProps = {
	oidcFetch: OidcFetch;
	userReady: boolean | null;
};
export const get__ = async (props: GetProps) => {
	const { userReady, oidcFetch } = props;
	const debugEnabled =
		typeof window !== "undefined" ? window["--nevada-debug"] : undefined;

	if (!userReady) {
		const { promise } = Promise.withResolvers();
		throw promise;
	}

	let url: URL | undefined;
	try {
		url = ServiceClient["~"].Paloma.Nevada.ls.$url();
		const data = await ServiceClient["~"].Paloma.Nevada.ls.$get(
			{},
			{
				fetch: oidcFetch,
			},
		);
		let response = (await data.text()) as unknown as Awaited<
			ReturnType<(typeof data)["json"]>
		>;
		debugEnabled &&
			console.log({
				ServiceClient: {
					atlasfiles: data.status,
					response,
				},
			});

		if (typeof response === "string") {
			response = destr(response);
		}

		const maybeError = (response as { error?: unknown }).error;
		const isErrorStatus = data.status > 401;
		if (isErrorStatus || maybeError !== undefined) {
			throw {
				FetchError: {
					message: `Response ${data.status}: ${data.statusText}`,
					url,
					response,
					error: maybeError,
				},
			};
		}

		if (data.status === 401) {
			throw {
				Unauthorized: {
					message: `Unauthorized ${data.status} ${data.statusText}`,
					url,
					response,
				},
			};
		}

		return response as typeof response & { error?: never };
	} catch (error) {
		const message = `Fetching ${url}`;
		console.warn({
			ServiceClient: {
				message,
				error: serializeError(error),
			},
		});

		throw new Error(message, { cause: deserializeError(error) });
	}
};

// type MagmapAtlasfile = Awaited<ReturnType<typeof GetMagmapAtlasfile>>;
export const NevadaLs = (props: {
	get: ReturnType<typeof get__>;
}) => {
	// const formatMessage = useFormatMessage();
	// const [active, _setActive] = useState(true);
	// const revalidate = useCallback(() => {
	// 	setActive(() => false);
	// 	setTimeout(() => {
	// 		setActive(() => true);
	// 	}, 39);
	// }, []);

	const data = use(props.get);
	return (
		<pre className="overflow-x-auto card-body">
			<code className={clsx("overflow-x-auto")}>
				{JSON.stringify(data, null, 2)}
			</code>
		</pre>
	);
};
