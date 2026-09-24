import { SectionContainer } from "@ext/catalog/actions/propsEditor/components/Sections/SectionContainer";
import t from "@ext/localization/locale/translate";
import SectionHeader from "@ext/settings/components/SectionHeader";
import { FeatureList } from "@ext/toggleFeatures/components/ToggleFeatures";

const ExperimentalSection = () => {
	return (
		<SectionContainer
			header={
				<SectionHeader
					description={t("app-settings.sections.experimental-features.description")}
					title={t("app-settings.sections.experimental-features.title")}
				/>
			}
		>
			<FeatureList />
		</SectionContainer>
	);
};

export default ExperimentalSection;
