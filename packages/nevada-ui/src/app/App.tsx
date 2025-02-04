import { Effect } from "effect";
import { useCallback, useMemo, useState } from "react";
import "./App.css";

export const App = () => {
	const [count, setCount] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies:
	const task = useMemo(
		() => Effect.sync(() => setCount((current) => current + 1)),
		[setCount],
	);

	const increment = useCallback(() => Effect.runSync(task), [task]);

	return (
		<>
			<h1>Paloma Nevada</h1>
			<button type={"button"} onClick={increment}>
				count is {count}
			</button>
			<div className="card"> a</div>
		</>
	);
};
