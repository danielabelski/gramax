import t from "@ext/localization/locale/translate";
import { Level } from "@ext/settings/logic/settings";

export type SettingsHeader = { title: string; description: string };

/**
 * Each level is its own settings window, so the header names the thing being
 * configured (app, workspace or catalog) instead of the generic app title.
 */
const settingsLevelHeader = (level: Level): SettingsHeader => {
	if (level === Level.workspace)
		return { title: t("workspace.edit"), description: t("workspace.configure-your-workspace") };
	if (level === Level.catalog)
		return {
			title: t("forms.catalog-edit-props.name"),
			description: t("forms.catalog-edit-props.description"),
		};
	return { title: t("app-settings.title"), description: t("app-settings.description") };
};

export default settingsLevelHeader;
