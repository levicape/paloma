import { Fragment } from "hono/jsx/jsx-runtime";
import { AuthnAuthorize } from "./$AuthnAuthorize";
import { AuthorizeProgress } from "./$AuthorizeProgress";

export default function Authorize() {
	return (
		<Fragment>
			<AuthorizeProgress />
			<AuthnAuthorize />
		</Fragment>
	);
}
