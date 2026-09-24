import { SectionContainer } from "@ext/catalog/actions/propsEditor/components/Sections/SectionContainer";
import UiLanguage from "@ext/localization/core/model/Language";
import t from "@ext/localization/locale/translate";
import SectionHeader from "@ext/settings/components/SectionHeader";
import SettingField from "@ext/settings/components/SettingField";
import SwitchSettingField from "@ext/settings/components/SwitchSettingField";
import Theme from "@ext/Theme/Theme";
import { FormDivider } from "@ui-kit/Form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui-kit/Select";

const GeneralSection = () => {
	return (
		<SectionContainer
			header={
				<SectionHeader
					description={t("app-settings.sections.general.description")}
					title={t("app-settings.sections.general.title")}
				/>
			}
		>
			<SettingField
				control={({ field }) => (
					<Select onValueChange={field.onChange} value={field.value}>
						<SelectTrigger>
							<SelectValue placeholder={t("app-settings.general.language.placeholder")} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={UiLanguage.en}>{t("app-settings.general.language.en")}</SelectItem>
							<SelectItem value={UiLanguage.ru}>{t("app-settings.general.language.ru")}</SelectItem>
						</SelectContent>
					</Select>
				)}
				name="general.language"
				title={t("app-settings.general.language.title")}
			/>
			<SettingField
				control={({ field }) => (
					<Select onValueChange={field.onChange} value={field.value}>
						<SelectTrigger>
							<SelectValue placeholder={t("app-settings.general.theme.placeholder")} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={Theme.light}>{t("app-settings.general.theme.light")}</SelectItem>
							<SelectItem value={Theme.dark}>{t("app-settings.general.theme.dark")}</SelectItem>
						</SelectContent>
					</Select>
				)}
				name="general.theme"
				title={t("app-settings.general.theme.title")}
			/>
			<FormDivider />
			<SwitchSettingField
				description={t("app-settings.compress-images.enabled-description")}
				name="compress-images.enabled"
				title={t("app-settings.compress-images.enabled")}
			/>
		</SectionContainer>
	);
};

export default GeneralSection;
