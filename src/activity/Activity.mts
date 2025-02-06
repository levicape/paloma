export interface Activity {
	$partial?: never;
	hash(): Promise<string>;
}
