import type { HomePageBreadcrumb } from "@core/SitePresenter/SitePresenter";
import t from "@ext/localization/locale/translate";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import { Button } from "@ui-kit/Button";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import BreadcrumbTrail from "./BreadcrumbTrail";
import FolderCardsGrid from "./FolderCardsGrid";

interface FolderPageProps {
	breadcrumb: HomePageBreadcrumb[];
	onNavigate: (item: HomePageBreadcrumb, index: number) => void;
	onBack: () => void;
	editMode?: boolean;
	items: string[];
	linkByName: Record<string, CatalogLink>;
	onRemoveFromFolder?: (catalogName: string) => void;
	onReorder?: (newOrder: string[]) => void;
	setIsAnyCardLoading: Dispatch<SetStateAction<boolean>>;
	extra?: ReactNode;
}

const FolderPage = ({
	breadcrumb,
	onNavigate,
	onBack,
	editMode,
	items,
	linkByName,
	onRemoveFromFolder,
	onReorder,
	setIsAnyCardLoading,
	extra,
}: FolderPageProps) => (
	<div className="flex flex-col gap-6">
		<div className="flex items-center gap-3">
			<Button
				className="w-fit gap-1 p-0 rounded-none h-auto text-muted hover:text-primary-fg"
				onClick={onBack}
				startIcon="chevron-left"
				variant="text"
			>
				{t("go-back")}
			</Button>
			<BreadcrumbTrail items={breadcrumb} onNavigate={onNavigate} />
		</div>
		{extra}
		<FolderCardsGrid
			editMode={editMode}
			items={items}
			linkByName={linkByName}
			onRemoveFromFolder={onRemoveFromFolder}
			onReorder={onReorder}
			setIsAnyCardLoading={setIsAnyCardLoading}
		/>
	</div>
);

export default FolderPage;
