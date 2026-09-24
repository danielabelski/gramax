import t from "@ext/localization/locale/translate";
import { useSetting } from "@ext/settings/logic/hooks";
import Theme from "@ext/Theme/Theme";
import { GlassToolbarIcon, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";

export const ThemeButton = () => {
	const [theme, setTheme] = useSetting("general.theme");
	const isDark = theme === Theme.dark;

	return (
		<GlassToolbarToggleButton
			onClick={() => setTheme(isDark ? Theme.light : Theme.dark)}
			tooltipText={t("change-theme")}
		>
			<GlassToolbarIcon icon={isDark ? "moon" : "sun"} />
		</GlassToolbarToggleButton>
	);
};
