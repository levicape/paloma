import { Fragment } from "hono/jsx/jsx-runtime";
import { AuthnClose } from "./$AuthnClose";
import { CloseProgress } from "./$CloseProgress";

export default function Close() {
	return (
		<Fragment>
			<CloseProgress />
			<AuthnClose />
		</Fragment>
	);
}
