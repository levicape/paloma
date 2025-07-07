import type { ErrorHandler } from "hono";
import { AppBody } from "../ui/AppBody";
import { SUSPENSE_GUARD } from "../ui/ClientSuspense";

const handler: ErrorHandler = (e, c) => {
	if ("getResponse" in e) {
		return e.getResponse();
	}
	if (e.message !== SUSPENSE_GUARD) {
		console.trace(e.message);
		c.status(500);
		return c.render(
			<AppBody>
				<h1>Internal Server Error</h1>
				<p>Something went wrong. Please try again later.</p>
			</AppBody>,
		);
	}

	return c.render(<AppBody />);
};

export default handler;
