import t from "@ext/localization/locale/translate";
import { useSetting } from "@ext/settings/logic/hooks";
import Theme from "@ext/Theme/Theme";
import { DropdownMenuItem } from "@ui-kit/Dropdown";
import { Icon } from "@ui-kit/Icon";

export const ThemeMenuItem = () => {
	const [theme, setTheme] = useSetting("general.theme");
	const isDark = theme === Theme.dark;

	return (
		<DropdownMenuItem onSelect={() => setTheme(isDark ? Theme.light : Theme.dark)}>
			<Icon icon={isDark ? "moon" : "sun"} />
			{t("change-theme")}
		</DropdownMenuItem>
	);
};
