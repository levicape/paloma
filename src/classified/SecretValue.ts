import type {
	Primitive,
	PrimitiveObject,
} from "../repository/workqueue/index.js";
type SecretId = string;
export class SecretValue<S = Primitive, U = Primitive>
	implements Record<string, unknown>
{
	protected $__ = "{}";
	private $_c_ = "SV";
	private $_e_ = "{}";
	private $_v_ = "{}";
	constructor(
		public value: string,
		public sid?: SecretId,
	) {
		this.$__ = JSON.stringify({
			value: value.length,
		});
	}
	readonly [n: number]: Primitive;
	length: number;
	[x: string]:
		| Primitive
		| ((
				// biome-ignore lint/suspicious/noExplicitAny:
				...p: any
		  ) => // biome-ignore lint/suspicious/noExplicitAny:
				| any
				| ((predicate: unknown, thisArg?: unknown) => boolean)
				| undefined)
		| undefined;
}

SecretValue.prototype.toString = function () {
	return this.$__;
};
