import type { Child } from "hono/jsx";
import type { FormatXMLElementFn } from "intl-messageformat";

export const HtmlFormatValues: Record<
	string,
	FormatXMLElementFn<Child, Child>
> = {
	span: (children: Child) => <span>{children}</span>,
	strong: (children: Child) => <strong>{children}</strong>,
	em: (children: Child) => <em>{children}</em>,
};
