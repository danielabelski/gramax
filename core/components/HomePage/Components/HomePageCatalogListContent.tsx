import Groups from "@components/HomePage/Groups";
import NoneGroups from "@components/HomePage/NoneGroups";
import type { HomePageData } from "@core/SitePresenter/SitePresenter";
import FavoriteCatalogLinkService from "@ext/article/Favorite/components/FavoriteCatalogLinkService";

export const HomePageCatalogListContent = ({ data }: { data: HomePageData }) => {
	const catalogCount = data.catalogsLinks.length;

	return catalogCount ? (
		<FavoriteCatalogLinkService.Init value={data.catalogsLinks}>
			<Groups
				className="groups"
				hasPersonalOverride={data.hasPersonalOverride}
				rootSections={data.rootSections}
				views={data.views}
			/>
		</FavoriteCatalogLinkService.Init>
	) : (
		<NoneGroups />
	);
};
