import FavoriteCatalogLinkService from "@ext/article/Favorite/components/FavoriteCatalogLinkService";
import t from "@ext/localization/locale/translate";
import type { CatalogLink } from "@ext/navigation/NavigationLinks";
import { ContentDivider } from "@ui-kit/Divider";
import { type Dispatch, Fragment, type SetStateAction, useMemo } from "react";
import { confirmConvertSectionToFolder, confirmHomepageDelete } from "../confirmations";
import { GROUP_ID_PREFIX } from "../dnd/ids";
import type { DropIndicator } from "../dnd/types";
import Group from "../Group";
import { type HomeGroupContextValue, HomeGroupProvider } from "../HomeGroupContext";
import { useHomepageLayoutStore } from "../store/homepageLayoutStore";
import { type HomeSection, type HomeSections, isHomeFolder, UNCATEGORIZED_ID } from "../utils/homeLayoutTypes";
import type { RenameState, SectionDragHandleProps, SectionEditActions, SortableGroupComponent } from "./sectionTypes";

interface SectionGroupsProps {
	dndSections: HomeSections;
	linkByName: Record<string, CatalogLink>;
	linksOf: (section: HomeSection) => CatalogLink[];
	editMode?: boolean;
	dropIndicator?: DropIndicator;
	layoutAnimationTick?: number;
	setPreviewFolderId: Dispatch<SetStateAction<string | null>>;
	setIsAnyCardLoading: Dispatch<SetStateAction<boolean>>;
	/**
	 * Injected by the lazily loaded edit-mode layer, which owns every dnd-kit import. Absent means sections are not
	 * draggable — that is the read-only homepage, and it must stay free of the dnd-kit bundle.
	 */
	sortableGroup?: SortableGroupComponent;
}

const SectionGroups = ({
	dndSections,
	linkByName,
	linksOf,
	editMode,
	dropIndicator,
	layoutAnimationTick = 0,
	setPreviewFolderId,
	setIsAnyCardLoading,
	sortableGroup: SortableGroup,
}: SectionGroupsProps) => {
	const setGroupTitle = useHomepageLayoutStore((state) => state.setGroupTitle);
	const deleteGroup = useHomepageLayoutStore((state) => state.deleteGroup);
	const convertSectionToFolder = useHomepageLayoutStore((state) => state.convertSectionToFolder);
	const convertFolderToSection = useHomepageLayoutStore((state) => state.convertFolderToSection);
	const deleteFolder = useHomepageLayoutStore((state) => state.deleteFolder);
	const renameFolder = useHomepageLayoutStore((state) => state.renameFolder);

	const groupContext = useMemo<HomeGroupContextValue>(
		() => ({
			setIsAnyCardLoading,
			editMode,
			linkByName,
			layoutAnimationTick,
			overTargetId: editMode ? dropIndicator?.targetId : undefined,
			onConvertFolderToSection: editMode ? convertFolderToSection : undefined,
			onDeleteFolder: editMode
				? async (folderId) => {
						if (await confirmHomepageDelete("folder")) deleteFolder(folderId);
					}
				: undefined,
			onOpenFolder: (folder) => setPreviewFolderId(folder.id),
			onRenameFolder: editMode ? renameFolder : undefined,
		}),
		[
			setIsAnyCardLoading,
			editMode,
			linkByName,
			layoutAnimationTick,
			dropIndicator?.targetId,
			convertFolderToSection,
			deleteFolder,
			renameFolder,
			setPreviewFolderId,
		],
	);

	const hasUncategorized = dndSections.some((section) => section.id === UNCATEGORIZED_ID && section.items.length > 0);
	const hasOtherSections = dndSections.some(
		(section) => section.id !== UNCATEGORIZED_ID && (editMode || section.items.length > 0),
	);
	const hasFavorites = FavoriteCatalogLinkService.value.length > 0;
	const hasGroupAbove = hasOtherSections || hasFavorites;

	const renderGroup = (section: HomeSection) => {
		const key = section.id;
		const isUncategorized = key === UNCATEGORIZED_ID;
		const showOtherDivider = isUncategorized && hasGroupAbove && (editMode || hasUncategorized);
		const editActions: SectionEditActions | undefined =
			editMode && !isUncategorized
				? {
						convertToFolderDisabled: !section.items.some((item) => item.type === "catalog"),
						onConvertToFolder: async () => {
							if (!section.items.some((item) => item.type === "catalog")) return;
							const hasFolders = section.items.some(isHomeFolder);
							if (hasFolders && !(await confirmConvertSectionToFolder())) return;
							convertSectionToFolder(key);
						},
						onDelete: async () => {
							if (await confirmHomepageDelete("section")) deleteGroup(key);
						},
						onTitleChange: (newTitle: string) => setGroupTitle(key, newTitle),
					}
				: undefined;
		const buildGroupNode = (renameState?: RenameState, dragHandleProps?: SectionDragHandleProps) => (
			<Group
				catalogLinks={linksOf(section)}
				containerKey={key}
				dragHandleProps={dragHandleProps}
				editActions={editActions}
				items={section.items}
				renameState={renameState}
				title={section.title}
			/>
		);
		const wrappedGroup =
			SortableGroup && !isUncategorized ? (
				<SortableGroup id={`${GROUP_ID_PREFIX}${key}`} key={key} scrollKey={key}>
					{(renameState, dragHandleProps) => buildGroupNode(renameState, dragHandleProps)}
				</SortableGroup>
			) : (
				<div className="scroll-mt-[52px] relative" data-group-key={key} key={key}>
					{buildGroupNode()}
				</div>
			);
		return (
			<Fragment key={key}>
				{showOtherDivider && (
					<ContentDivider>
						<div className="text-medium text-center font-normal text-muted whitespace-nowrap">
							{t("uncategorized-title")}
						</div>
					</ContentDivider>
				)}
				{wrappedGroup}
			</Fragment>
		);
	};

	const renderedSections = editMode ? dndSections : dndSections.filter((section) => section.items.length > 0);

	if (renderedSections.length === 0) return null;

	return (
		<HomeGroupProvider value={groupContext}>
			{renderedSections.map((section) => renderGroup(section))}
		</HomeGroupProvider>
	);
};

export default SectionGroups;
