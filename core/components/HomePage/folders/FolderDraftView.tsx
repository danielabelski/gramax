import { useRouter } from "@core/Api/useRouter";
import type { HomePageBreadcrumb } from "@core/SitePresenter/SitePresenter";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import { type Dispatch, type SetStateAction, useMemo } from "react";
import type { HomeFolder } from "../utils/homeLayoutTypes";
import FolderPage from "./FolderPage";

interface FolderDraftViewProps {
	folder: HomeFolder;
	linkByName: Record<string, CatalogLink>;
	setIsAnyCardLoading: Dispatch<SetStateAction<boolean>>;
	breadcrumb: HomePageBreadcrumb[];
	editMode?: boolean;
	onBack: () => void;
	onRemoveFromFolder?: (catalogName: string) => void;
	onReorder?: (newOrder: string[]) => void;
}

const FolderDraftView = ({
	folder,
	linkByName,
	setIsAnyCardLoading,
	breadcrumb,
	editMode,
	onBack,
	onRemoveFromFolder,
	onReorder,
}: FolderDraftViewProps) => {
	const router = useRouter();
	const fullBreadcrumb = useMemo<HomePageBreadcrumb[]>(
		() => [{ title: "", href: "/" }, ...breadcrumb, { title: folder.title, href: "" }],
		[breadcrumb, folder.title],
	);

	return (
		<FolderPage
			breadcrumb={fullBreadcrumb}
			editMode={editMode}
			items={folder.items}
			linkByName={linkByName}
			onBack={onBack}
			onNavigate={(b, index) => (index === 0 ? onBack() : router.pushPath(b.href))}
			onRemoveFromFolder={onRemoveFromFolder}
			onReorder={onReorder}
			setIsAnyCardLoading={setIsAnyCardLoading}
		/>
	);
};

export default FolderDraftView;
