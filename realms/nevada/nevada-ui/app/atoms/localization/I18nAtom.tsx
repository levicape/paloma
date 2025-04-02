import { useCallback } from "hono/jsx";
import { useAtom } from "jotai/react";
import { atomWithStorage } from "jotai/utils";

export const I18nSupportedLanguages = ["en", "es"] as const;
export type I18nSupportedLanguage = (typeof I18nSupportedLanguages)[number];
export type I18nAtomState = {
	selectedLanguage: I18nSupportedLanguage;
};

export const I18nAtomSymbol = Symbol.for("I18N_ATOM");

export const I18nAtom = atomWithStorage(
	String(I18nAtomSymbol),
	{
		selectedLanguage: "en" as I18nSupportedLanguage,
	} as I18nAtomState,
	{
		getItem(key, initialValue) {
			const storedValue = localStorage.getItem(key);
			try {
				const parsedValue = JSON.parse(storedValue ?? "");
				return {
					...parsedValue,
				};
			} catch {
				return {
					...initialValue,
				};
			}
		},
		setItem(key, value) {
			const copy: Partial<typeof value> = { ...value };
			localStorage.setItem(key, JSON.stringify(copy));
		},
		removeItem(key) {
			localStorage.removeItem(key);
		},
		subscribe(key, callback, initialValue) {
			if (
				typeof window === "undefined" ||
				typeof window.addEventListener === "undefined"
			) {
				return () => {};
			}

			const refresh = (e: StorageEvent) => {
				if (e.storageArea === localStorage && e.key === key) {
					let newValue: typeof initialValue;
					try {
						newValue = JSON.parse(e.newValue ?? "");
					} catch {
						newValue = initialValue;
					}
					callback({
						...newValue,
					});
				}
			};
			window.addEventListener("storage", refresh);

			return () => {
				window.removeEventListener("storage", refresh);
			};
		},
	},
);

export const I18nAtomActions = {
	SetLanguage: (language: I18nSupportedLanguage) => ({
		$kind: "SET_LANGUAGE",
		payload: language,
	}),
};

export type I18nAction = ReturnType<typeof I18nAtomActions.SetLanguage>;
export const I18nReducer = (
	state: I18nAtomState,
	action: I18nAction,
): I18nAtomState => {
	switch (action.$kind) {
		case "SET_LANGUAGE":
			return {
				...state,
				selectedLanguage: action.payload,
			};
		default:
			return state;
	}
};

export const useI18nAtom = () => {
	const [state, setState] = useAtom(I18nAtom);
	const dispatch = useCallback(
		(action: I18nAction) => setState((prev) => I18nReducer(prev, action)),
		[setState],
	);
	return [state, dispatch] as const;
};

export const useI18n = () => useI18nAtom()[0];
export const useFormatMessage = () => {
	return useCallback(
		(parameters: {
			id: string;
			defaultMessage?: string;
			description?: string;
		}) => {
			return parameters.defaultMessage ?? parameters.id;
		},
		[],
	);
};
