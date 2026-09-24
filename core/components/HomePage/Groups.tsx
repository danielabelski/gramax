import { useRouter } from "@core/Api/useRouter";
import type { HomePageBreadcrumb, HomePageData, Section } from "@core/SitePresenter/SitePresenter";
import homeSections from "@core/utils/homeSections";
import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import WorkspaceService from "@core-ui/ContextServices/Workspace";
import { cn } from "@core-ui/utils/cn";
import FavoriteCatalogLinkService from "@ext/article/Favorite/components/FavoriteCatalogLinkService";
import t from "@ext/localization/locale/translate";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import { type Dispatch, lazy, type SetStateAction, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { confirmDiscardChanges, confirmEmptySections } from "./confirmations";
import FolderDraftView from "./folders/FolderDraftView";
import FolderPage from "./folders/FolderPage";
import Group from "./Group";
import { HomeGroupProvider } from "./HomeGroupContext";
import HomeLayoutEditBar from "./HomeLayoutEditBar";
import SectionGroups from "./sections/SectionGroups";
import { selectHomeSections, useHomepageLayoutStore } from "./store/homepageLayoutStore";
import { useHomepageLayoutShortcuts } from "./useHomepageLayoutShortcuts";
import { buildLinkIndex, sectionToFolder } from "./utils/homeLayoutBuilders";
import {
	type HomeFolder,
	type HomeLayoutEditScope,
	type HomeSection,
	type HomeSections,
	UNCATEGORIZED_ID,
} from "./utils/homeLayoutTypes";

// the only homepage path into dnd-kit for sections — kept lazy so a read-only homepage never downloads it
const SectionsDnd = lazy(() => import("./sections/SectionsDnd"));

interface GroupsProps {
	className?: string;
	views: HomePageData["views"];
	rootSections?: HomePageData["rootSections"];
	hasPersonalOverride: boolean;
}

interface ViewGroupProps {
	group?: string;
	section: Section;
	setIsAnyCardLoading: Dispatch<SetStateAction<boolean>>;
	editMode?: boolean;
	breadcrumb: HomePageBreadcrumb[];
}

const SectionView = ({ section, setIsAnyCardLoading, group, editMode = false, breadcrumb }: ViewGroupProps) => {
	const sections = useHomepageLayoutStore(selectHomeSections);
	const removeFromFolder = useHomepageLayoutStore((state) => state.removeFromFolder);
	const reorderFolderItems = useHomepageLayoutStore((state) => state.reorderFolderItems);
	const [previewFolderId, setPreviewFolderId] = useState<string | null>(null);

	// the whole dnd layer memoizes on this index, so rebuilding it every render would defeat all of it
	const linkByName = useMemo(() => buildLinkIndex(section), [section]);

	useEffect(() => {
		if (!group) return;
		const id = requestAnimationFrame(() => {
			document
				.querySelector(`[data-group-key="${group}"]`)
				?.scrollIntoView({ behavior: "smooth", block: "start" });
		});
		return () => cancelAnimationFrame(id);
	}, [group]);

	const linksOf = useCallback(
		(homeSection: HomeSection) =>
			homeSection.items
				.flatMap((item) => (item.type === "catalog" ? [item.name] : item.items))
				.map((n) => linkByName[n])
				.filter((l): l is CatalogLink => Boolean(l)),
		[linkByName],
	);

	// also the Suspense fallback: the same layout, just not draggable yet
	const staticSections = (
		<SectionGroups
			dndSections={sections}
			linkByName={linkByName}
			linksOf={linksOf}
			setIsAnyCardLoading={setIsAnyCardLoading}
			setPreviewFolderId={setPreviewFolderId}
		/>
	);

	// the folder alone is not enough to edit it: folder ids are unique per section, not across the layout
	const preview = previewFolderId
		? (sections
				.map((homeSection) => ({
					sectionId: homeSection.id,
					folder: homeSection.items.find(
						(item): item is HomeFolder => item.type === "folder" && item.id === previewFolderId,
					),
				}))
				.find((candidate): candidate is { sectionId: string; folder: HomeFolder } =>
					Boolean(candidate.folder),
				) ?? null)
		: null;

	if (preview) {
		return (
			<FolderDraftView
				breadcrumb={breadcrumb}
				editMode={editMode}
				folder={preview.folder}
				linkByName={linkByName}
				onBack={() => setPreviewFolderId(null)}
				onRemoveFromFolder={(name) => removeFromFolder(preview.sectionId, preview.folder.id, name)}
				onReorder={(newOrder) => reorderFolderItems(preview.sectionId, preview.folder.id, newOrder)}
				setIsAnyCardLoading={setIsAnyCardLoading}
			/>
		);
	}

	return editMode ? (
		<Suspense fallback={staticSections}>
			<SectionsDnd
				linkByName={linkByName}
				linksOf={linksOf}
				sections={sections}
				setIsAnyCardLoading={setIsAnyCardLoading}
				setPreviewFolderId={setPreviewFolderId}
			/>
		</Suspense>
	) : (
		staticSections
	);
};

const FolderView = ({ section, setIsAnyCardLoading, editMode, breadcrumb }: ViewGroupProps) => {
	const router = useRouter();
	const sections = useHomepageLayoutStore(selectHomeSections);
	const removeFromFolder = useHomepageLayoutStore((state) => state.removeFromFolder);
	const reorderFolderItems = useHomepageLayoutStore((state) => state.reorderFolderItems);

	const linkByName = useMemo(() => buildLinkIndex(section), [section]);
	const foldersFromSections = useMemo(
		() => Object.entries(section.sections || {}).map(([id, child]) => sectionToFolder(id, child)),
		[section],
	);
	const groupContext = useMemo(() => ({ setIsAnyCardLoading, linkByName }), [setIsAnyCardLoading, linkByName]);

	const parentHref = breadcrumb[breadcrumb.length - 2]?.href ?? "/";
	// the folder page is addressed by its own href, so the store lookup needs no extra field on the wire
	const path = useMemo(() => homeSections.getHomePathSections(section.href), [section.href]);
	const folderTarget = useMemo(() => {
		const folderId = path[path.length - 1];
		const containerId = path.length === 1 ? UNCATEGORIZED_ID : path.length === 2 ? path[0] : null;
		const folder = containerId
			? sections
					.find((section) => section.id === containerId)
					?.items.find((item): item is HomeFolder => item.type === "folder" && item.id === folderId)
			: null;
		return folder && containerId ? { containerId, folderId, folder } : null;
	}, [path, sections]);
	const items = folderTarget?.folder.items ?? (section.catalogLinks || []).map((l) => l.name);
	const folderEditMode = editMode && Boolean(folderTarget);

	return (
		<FolderPage
			breadcrumb={breadcrumb}
			editMode={folderEditMode}
			extra={
				<HomeGroupProvider value={groupContext}>
					<Group catalogLinks={[]} items={foldersFromSections} />
				</HomeGroupProvider>
			}
			items={items}
			linkByName={linkByName}
			onBack={() => router.pushPath(parentHref)}
			onNavigate={(b) => router.pushPath(b.href)}
			onRemoveFromFolder={
				folderTarget
					? (name) => removeFromFolder(folderTarget.containerId, folderTarget.folderId, name)
					: undefined
			}
			onReorder={
				folderTarget
					? (newOrder) => reorderFolderItems(folderTarget.containerId, folderTarget.folderId, newOrder)
					: undefined
			}
			setIsAnyCardLoading={setIsAnyCardLoading}
		/>
	);
};

type HomepageLayoutSavePayload = {
	scope: HomeLayoutEditScope;
	sections: HomeSections;
};

const Groups = (props: GroupsProps) => {
	const { className, hasPersonalOverride, rootSections, views } = props;
	const [isAnyCardLoading, setIsAnyCardLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const activeView = useHomepageLayoutStore((state) => state.activeView);
	const init = useHomepageLayoutStore((state) => state.init);
	const editScope = useHomepageLayoutStore((state) => state.editScope);
	const commitEdit = useHomepageLayoutStore((state) => state.commitEdit);
	const cancelEdit = useHomepageLayoutStore((state) => state.cancelEdit);
	const deleteGroup = useHomepageLayoutStore((state) => state.deleteGroup);
	const addGroup = useHomepageLayoutStore((state) => state.addGroup);
	const hasUnsavedChanges = useHomepageLayoutStore((state) => state.hasUnsavedChanges);
	const setIsMainPage = useHomepageLayoutStore((state) => state.setIsMainPage);
	const sections = useHomepageLayoutStore(selectHomeSections);
	const favoriteCatalogLinks = FavoriteCatalogLinkService.value;
	const editMode = editScope !== null;
	const { section, breadcrumb, group } = views[activeView];

	const isMainPage = breadcrumb.length === 0;
	const ViewGroup = !isMainPage ? FolderView : SectionView;
	const favoritesContext = useMemo(() => ({ setIsAnyCardLoading }), []);
	const apiUrlCreator = ApiUrlCreatorService.value;
	const isGesWorkspace = Boolean(PageDataContextService.value.conf.enterprise?.gesUrl);
	const workspacePath = WorkspaceService.current()?.path;

	useEffect(() => {
		setIsMainPage(isMainPage);
	}, [isMainPage, setIsMainPage]);

	useEffect(() => {
		init(
			rootSections?.global ?? views.global.section,
			rootSections?.personal ?? views.personal.section,
			hasPersonalOverride,
			workspacePath,
		);
	}, [hasPersonalOverride, init, rootSections, views, workspacePath]);

	useHomepageLayoutShortcuts(editMode);

	const savePersonalSections = async (sections: HomeSections) => {
		const url = apiUrlCreator.saveWorkspaceSections();
		await FetchService.fetch(url, JSON.stringify({ scope: "personal", sections }));
	};

	const saveGlobalSections = async (sections: HomeSections) => {
		if (isGesWorkspace)
			await FetchService.fetch(apiUrlCreator.saveEnterpriseWorkspaceSections(), JSON.stringify(sections));
		await FetchService.fetch(apiUrlCreator.saveWorkspaceSections(), JSON.stringify({ scope: "global", sections }));
	};

	const handleHomepageLayoutSave = async (payload: HomepageLayoutSavePayload) => {
		if (payload.scope === "personal") await savePersonalSections(payload.sections);
		else await saveGlobalSections(payload.sections);
	};

	const handleSave = async () => {
		if (!editScope || isSaving) return;
		if (!hasUnsavedChanges()) {
			commitEdit();
			return;
		}

		const emptySectionKeys = isMainPage
			? sections
					.filter((section) => section.id !== UNCATEGORIZED_ID && section.items.length === 0)
					.map((section) => section.id)
			: [];
		if (emptySectionKeys.length && !(await confirmEmptySections())) return;

		setIsSaving(true);
		try {
			await handleHomepageLayoutSave({
				scope: editScope,
				sections: sections.filter((section) => !emptySectionKeys.includes(section.id)),
			});

			for (const key of emptySectionKeys) deleteGroup(key);
			commitEdit();
		} finally {
			setIsSaving(false);
		}
	};

	const handleCancel = async () => {
		if (hasUnsavedChanges() && !(await confirmDiscardChanges())) return;
		cancelEdit();
	};

	return (
		<div className={cn("flex-1", className)} style={isAnyCardLoading || isSaving ? { pointerEvents: "none" } : {}}>
			<div className="mx-auto flex flex-col gap-12 max-[40rem]:gap-8">
				{!!favoriteCatalogLinks.length && isMainPage && (
					<HomeGroupProvider value={favoritesContext}>
						<Group catalogLinks={favoriteCatalogLinks} title={t("favorites")} />
					</HomeGroupProvider>
				)}
				<ViewGroup
					breadcrumb={breadcrumb}
					editMode={editMode}
					group={group}
					section={section}
					setIsAnyCardLoading={setIsAnyCardLoading}
				/>
			</div>
			{editScope && (
				<HomeLayoutEditBar
					isSaving={isSaving}
					onAddSection={isMainPage ? addGroup : undefined}
					onCancel={handleCancel}
					onSave={handleSave}
					scope={editScope}
				/>
			)}
		</div>
	);
};

export default Groups;
