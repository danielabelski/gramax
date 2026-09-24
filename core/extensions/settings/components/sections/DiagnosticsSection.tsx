import { SectionContainer } from "@ext/catalog/actions/propsEditor/components/Sections/SectionContainer";
import t from "@ext/localization/locale/translate";
import SectionHeader from "@ext/settings/components/SectionHeader";
import SwitchSettingField from "@ext/settings/components/SwitchSettingField";
import { Divider } from "@ui-kit/Divider";
import { Field } from "@ui-kit/Field";
import ExportLogsButton from "./ExportLogsButton";
import LogLevelSelect from "./LogLevelSelect";

const DiagnosticsSection = () => {
	return (
		<SectionContainer
			header={
				<SectionHeader
					description={t("app-settings.sections.diagnostics.description")}
					title={t("app-settings.sections.diagnostics.title")}
				/>
			}
		>
			<Field
				control={() => <LogLevelSelect className="w-full shrink-0" />}
				description={t("log-level.description")}
				labelClassName="w-[30%] shrink-0"
				layout="horizontal"
				title={t("log-level.title")}
			/>
			<SwitchSettingField
				description={t("app-settings.diagnostics.logging.console-description")}
				fallbackValue
				name="logging.console"
				title={t("app-settings.diagnostics.logging.console")}
			/>
			<Divider />
			<Field
				control={() => <ExportLogsButton className="w-fit" endIcon="chevron-down" iconClassName="text-muted" />}
				description={t("app-settings.diagnostics.troubleshooting.description")}
				labelClassName="w-[30%] shrink-0"
				layout="horizontal"
				title={t("app-settings.diagnostics.troubleshooting.title")}
			/>
		</SectionContainer>
	);
};

export default DiagnosticsSection;
