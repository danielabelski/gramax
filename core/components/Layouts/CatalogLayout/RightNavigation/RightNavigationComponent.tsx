import { RightNavigationTop } from "@components/Layouts/CatalogLayout/RightNavigation/RightNavigaitonTop";
import RightNavigation from "@components/Layouts/CatalogLayout/RightNavigation/RightNavigation";
import { RightNavigationBottom } from "@components/Layouts/CatalogLayout/RightNavigation/RightNavigationBottom";
import RightNavigationLayout from "@components/Layouts/CatalogLayout/RightNavigation/RightNavigationLayout";
import { EXPANDED_RIGHT_NAVIGATION_CLASS_NAME } from "./constants";

const RightNavigationComponent = () => {
	return (
		<>
			<RightNavigationTop />
			<div className={`${EXPANDED_RIGHT_NAVIGATION_CLASS_NAME} h-full`}>
				<RightNavigationLayout>
					<div className="pointer-events-auto flex min-h-0 flex-1 flex-col">
						<RightNavigation />
					</div>
				</RightNavigationLayout>
			</div>
			<RightNavigationBottom />
		</>
	);
};

export default RightNavigationComponent;
