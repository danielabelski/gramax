import BottomInfo from "@components/HomePage/BottomInfo";
import { HomePageCatalogListContent } from "@components/HomePage/Components/HomePageCatalogListContent";
import { HomePageWrapper } from "@components/HomePage/Components/HomePageWrapper";
import { useRouter } from "@core/Api/useRouter";
import type { HomePageData } from "@core/SitePresenter/SitePresenter";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { GlobalAudioToolbar } from "@ext/ai/components/Audio/Toolbar";
import { SignInGesCloudForm } from "@ext/enterprise-cloud/components/GesCloudSignInFormModal";
import { GesCloudTopMenu } from "@ext/enterprise-cloud/components/HomePage/GesCloudTopMenu";

export const GesCloudEditorHomePage = ({ data }: { data: HomePageData }) => {
	const { conf, isLogged } = PageDataContextService.value;
	const { enabled } = conf.enterpriseCloud;
	const router = useRouter();
	const inviteId = router.query.inviteId;
	const showCatalogs = isLogged || !enabled;

	return (
		<HomePageWrapper>
			<GesCloudTopMenu section={data.views.global.section} />
			{showCatalogs ? (
				<HomePageCatalogListContent data={data} />
			) : (
				<div className="flex justify-center items-center h-screen">
					<SignInGesCloudForm allowContinueWithoutAccount={!inviteId} />
				</div>
			)}
			<BottomInfo />
			<GlobalAudioToolbar />
		</HomePageWrapper>
	);
};
