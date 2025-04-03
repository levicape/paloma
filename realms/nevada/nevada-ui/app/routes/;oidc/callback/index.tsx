import { Fragment } from "hono/jsx/jsx-runtime";
import { AuthnCallback } from "./$AuthnCallback";
import { CallbackProgress } from "./$CallbackProgress";

export default function Callback() {
	return (
		<Fragment>
			<CallbackProgress />
			<AuthnCallback />
		</Fragment>
	);
}
