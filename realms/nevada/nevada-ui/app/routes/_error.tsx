import type { ErrorHandler } from "hono";
import { Fragment } from "hono/jsx";
import { SUSPENSE_GUARD } from "../ui/ClientSuspense";

const handler: ErrorHandler = (e, c) => {
	if ("getResponse" in e) {
		return e.getResponse();
	}
	if (e.message !== SUSPENSE_GUARD) {
		console.trace(e.message);
		c.status(500);
		return c.render(
			<Fragment>
				<h1>Internal Server Error</h1>
				<p>Something went wrong. Please try again later.</p>
			</Fragment>,
		);
	}

	return c.render(<Fragment />);
};

export default handler;
