import { createContext } from "hono/jsx";

export type HeaderOpenContext = [boolean, (val?: boolean) => void];
const HeaderMenuOpenContext = createContext<HeaderOpenContext>([
	false,
	() => {},
]);
export const HeaderMenuOpenContextExport = () => HeaderMenuOpenContext;
const HeaderSettingsOpenContext = createContext<HeaderOpenContext>([
	false,
	() => {},
]);
export const HeaderSettingsOpenContextExport = () => HeaderSettingsOpenContext;
