import { clsx } from "clsx";
import {
	type DOMAttributes,
	type Event,
	type FC,
	Fragment,
	useCallback,
} from "hono/jsx";
import { Select, type SelectProps } from "../../../ui/daisy/field/Select";
import {
	LanguageGlyphs_Icon,
	type LanguageGlyphs_IconProps,
} from "../../../ui/display/icons/LanguageGlyphs";
import {
	I18nAtomActions,
	type I18nSupportedLanguage,
	I18nSupportedLanguages,
	useI18nAtom,
} from "../I18nAtom";

const languageText: Record<I18nSupportedLanguage, string> = {
	en: "English",
	es: "Español",
};

export type LanguageDropdownProps = {
	className?: string;
	glyph?: FC | null;
	glyphProps?: LanguageGlyphs_IconProps;
	selectClassname?: string;
	selectProps?: Omit<SelectProps, "className" | "onChange" | "defaultValue"> &
		DOMAttributes;
	optionClassname?: (
		language: keyof typeof languageText,
		index: number,
	) => string;
	optionProps?: (
		language: keyof typeof languageText,
		index: number,
	) => DOMAttributes;
};

export const LanguageDropdown: FC = ({
	className,
	glyph,
	glyphProps,
	selectClassname,
	selectProps,
	optionClassname,
	optionProps,
	...htmlProps
}: LanguageDropdownProps & DOMAttributes) => {
	const [i18nState, dispatch] = useI18nAtom();
	const { selectedLanguage: language } = i18nState;

	const languageOnChange = useCallback(
		({ target }: Event & { target?: { value?: unknown } | null }) => {
			if (target?.value) {
				dispatch(
					I18nAtomActions.SetLanguage(target?.value as I18nSupportedLanguage),
				);
			}
		},
		[dispatch],
	);

	const Glyph =
		glyph === undefined
			? LanguageGlyphs_Icon
			: glyph !== null
				? glyph
				: Fragment;
	return (
		<div className={clsx("flex", "items-center", className)} {...htmlProps}>
			<Glyph {...glyphProps} />
			<Select
				className={clsx("ml-2", "w-full", "bg-transparent", selectClassname)}
				onChange={languageOnChange}
				value={language}
				{...selectProps}
			>
				{I18nSupportedLanguages.map((language, index) => {
					return (
						<option
							key={language}
							value={language}
							className={clsx(optionClassname?.(language, index))}
							{...(optionProps?.(language, index) ?? {})}
						>
							{languageText[language]}
						</option>
					);
				})}
			</Select>
		</div>
	);
};
