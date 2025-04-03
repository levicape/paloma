import { Fragment } from "hono/jsx/jsx-runtime";
import { AuthnLogout } from "./$AuthnLogout";
import { LogoutProgress } from "./$LogoutProgress";

export default function Callback() {
	return (
		<Fragment>
			<LogoutProgress />
			<AuthnLogout />
		</Fragment>
	);
}
