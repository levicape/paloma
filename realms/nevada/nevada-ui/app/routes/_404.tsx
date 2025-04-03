import type { NotFoundHandler } from "hono";
import { AppBody } from "../ui/AppBody";

const handler: NotFoundHandler = (c) => {
	return c.render(
		<AppBody>
			<h1>Page Not Found</h1>
			<p>The page you are looking for does not exist.</p>
		</AppBody>,
	);
};

export default handler;
