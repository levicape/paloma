import { jsxRenderer } from "hono/jsx-renderer";
import { AppBody } from "../../ui/AppBody";

export default jsxRenderer(({ children, Layout }) => {
	return (
		<Layout>
			<AppBody>{children}</AppBody>
		</Layout>
	);
});
