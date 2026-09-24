import Links from "@components/Layouts/layoutComponents";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { getCatalogLinks, useGetArticleLinks } from "@core-ui/getRigthSidebarLinks";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import type { TitledLink } from "@ext/navigation/NavigationLinks";
import { QuizNavigationInfo } from "@ext/quiz/components/QuizNavigationInfo";
import PublishStatusPanel from "@ext/static/components/PublishStatusPanel";

interface LinksSectionData {
	articleLinks: TitledLink[];
	catalogLinks: TitledLink[];
	cloudServiceUrl?: string;
	hasContent: boolean;
}

export const useLinksSectionData = (): LinksSectionData => {
	const articleLinks = useGetArticleLinks();
	const catalogLinks = getCatalogLinks();
	const cloudServiceUrl = PageDataContextService.value.conf.cloudServiceUrl;
	const { isNext } = usePlatform();

	return {
		articleLinks,
		catalogLinks,
		cloudServiceUrl,
		hasContent: !!articleLinks.length || !!catalogLinks.length || !!cloudServiceUrl || isNext,
	};
};

export const LinksSectionContent = ({ data }: { data: LinksSectionData }) => {
	const { articleLinks, catalogLinks, cloudServiceUrl } = data;

	return (
		<>
			<Links articleLinks={articleLinks} catalogLinks={catalogLinks} />
			{cloudServiceUrl && <PublishStatusPanel />}
			<QuizNavigationInfo />
		</>
	);
};

export const LinksSection = () => <LinksSectionContent data={useLinksSectionData()} />;
