import ArticleUpdaterService from "@components/Article/ArticleUpdater/ArticleUpdaterService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import ArticleViewService from "@core-ui/ContextServices/views/articleView/ArticleViewService";
import useSetArticleDiffView from "@core-ui/hooks/diff/useSetArticleDiffView";
import { RequestStatus, useApi } from "@core-ui/hooks/useApi";
import { useScrollPositionStore } from "@core-ui/stores/ScrollPositionStore";
import { useDiffExtendedMode } from "@ext/git/core/Diff/components/store/DiffExtendedModeStore";
import { useDiffToggle } from "@ext/git/core/Diff/logic/hooks/useDiffToggle";
import { useLeaveDiffView } from "@ext/git/core/Diff/logic/hooks/useLeaveDiffView";
import { countSelectedVisibleEntries, isDiffEntryVisible } from "@ext/git/core/Diff/logic/utils/visibleDiffEntries";
import type { DiffFlattenTreeAnyItem } from "@ext/git/core/GitDiffItemCreator/RevisionDiffPresenter";
import { PublishHealthcheckCode, type PublishHealthcheckResult } from "@ext/git/core/GitPublish/PublishHealthcheck";
import { useDiscard } from "@ext/git/core/GitPublish/useDiscard";
import usePublish from "@ext/git/core/GitPublish/usePublish";
import usePublishDiffEntries from "@ext/git/core/GitPublish/usePublishDiffEntries";
import usePublishSelection from "@ext/git/core/GitPublish/usePublishSelectedFiles";
import t from "@ext/localization/locale/translate";
import useIsSourceDataValid from "@ext/storage/components/useIsSourceDataValid";
import {
	PanelEmptyState,
	PanelEmptyStateDescription,
	PanelEmptyStateIcon,
	PanelEmptyStateTitle,
	useFloatingPanelStore,
} from "@ui-kit/FloatingPanel";
import { Loader } from "@ui-kit/Loader";
import { ScrollShadowContainer } from "@ui-kit/ScrollShadowContainer";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PublishFooter } from "./components/PublishFooter";
import { PublishSelectAllRow } from "./components/PublishSelectAllRow";
import { PublishTree } from "./components/PublishTree";
import { PUBLISH_PANEL_ID } from "./constants";

export const PublishPanelContent = () => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const apiUrlCreatorRef = useRef(apiUrlCreator);
	apiUrlCreatorRef.current = apiUrlCreator;

	const [isDiscarding, setIsDiscarding] = useState(false);
	const [activePath, setActivePath] = useState<string>(null);

	const setIsOpen = useFloatingPanelStore((state) => state.setIsOpen);
	const isPanelOpen = useFloatingPanelStore((state) => state.panels[PUBLISH_PANEL_ID]?.isOpen);
	const clearAllPositions = useScrollPositionStore((state) => state.clearAll);
	const extendedMode = useDiffExtendedMode();
	const diffToggle = useDiffToggle();
	const setArticleDiffView = useSetArticleDiffView(null, "HEAD");
	const canPush = useIsSourceDataValid();

	const {
		data: publishHealth,
		status: publishHealthStatus,
		call: checkPublishHealth,
	} = useApi<PublishHealthcheckResult>({ url: (api) => api.getStoragePublishHealthcheckUrl() });

	const { diffTree, overview, isEntriesLoading, isEntriesReady } = usePublishDiffEntries({ autoUpdate: true });
	const { selectedFiles, isSelectedAll, selectFile, selectAll, isSelected, resetSelection } = usePublishSelection({
		diffTree,
	});

	const onChangesClear = useCallback(() => {
		resetSelection();
		clearAllPositions();
		setIsOpen(PUBLISH_PANEL_ID, false);
	}, [resetSelection, clearAllPositions, setIsOpen]);

	const leaveDiffView = useLeaveDiffView();
	const onPublished = useCallback(() => {
		onChangesClear();
		leaveDiffView();
	}, [onChangesClear, leaveDiffView]);

	const { isPublishing, message, publish, setMessage } = usePublish({
		diffTree,
		selectedFiles,
		onPublished,
	});

	const { discard } = useDiscard(selectedFiles);

	// biome-ignore lint/correctness/useExhaustiveDependencies: runs on open and close only
	useEffect(() => {
		diffToggle();

		return () => {
			const wasDiffView = !ArticleViewService.isDefaultView();
			ArticleViewService.setDefaultView();
			if (!wasDiffView) return;

			void ArticleUpdaterService.update(apiUrlCreatorRef.current).then(() => refreshPage());
		};
	}, []);

	useEffect(() => {
		if (!canPush) return;
		void checkPublishHealth();
	}, [canPush, checkPublishHealth]);

	const discardPaths = useCallback(
		async (paths?: string[]) => {
			setIsDiscarding(true);
			await discard(paths?.filter(Boolean) || Array.from(selectedFiles), !paths);
			setIsDiscarding(false);

			if (!paths) return onChangesClear();
		},
		[discard, selectedFiles, onChangesClear],
	);

	const onDiscardItem = useCallback(
		(item: DiffFlattenTreeAnyItem) => {
			if (item.type === "node") return;

			const paths = [item.filepath.new, item.filepath.old];
			if (item.type === "item")
				item.resources?.forEach((resource) => paths.push(resource.filePath.path, resource.filePath.oldPath));

			void discardPaths(paths);
		},
		[discardPaths],
	);

	const onSelectItem = useCallback(
		(item: DiffFlattenTreeAnyItem, checked: boolean) => {
			if (item.type === "node") return;
			if (isSelectedAll) selectAll(checked);
			selectFile(item.filepath.new, checked, item.filepath.old);
		},
		[isSelectedAll, selectAll, selectFile],
	);

	const isItemSelected = useCallback(
		(item: DiffFlattenTreeAnyItem) => {
			if (item.type === "node") return false;
			return isSelected(item.filepath.new, item.filepath.old);
		},
		[isSelected],
	);

	const onOpenItem = useCallback(
		(item: DiffFlattenTreeAnyItem) => {
			if (item.type === "node") return;
			setActivePath(item.filepath.new);
			setArticleDiffView(item);
		},
		[setArticleDiffView],
	);

	const items = useMemo(
		() => (diffTree?.data ?? []).filter((item) => isDiffEntryVisible(item, extendedMode)),
		[diffTree, extendedMode],
	);
	const currentContent = { items, overview, message };
	const [publishingContent, setPublishingContent] = useState<typeof currentContent>(null);
	const lastOpenContentRef = useRef(currentContent);

	if (isPanelOpen && !publishingContent && !isPublishing) lastOpenContentRef.current = currentContent;
	const visibleContent =
		publishingContent ?? (isPanelOpen && !isPublishing ? currentContent : lastOpenContentRef.current);

	useLayoutEffect(() => {
		if (isPanelOpen && !isPublishing) setPublishingContent(null);
	}, [isPanelOpen, isPublishing]);

	const publishCurrentContent = useCallback(async () => {
		setPublishingContent({ items, overview, message });
		if (!(await publish())) setPublishingContent(null);
	}, [items, overview, message, publish]);

	const isFileSelected = useCallback(
		(file: DiffFlattenTreeAnyItem) => {
			if (file.type === "node") return false;
			return isSelected(file.filepath.new, file.filepath.old);
		},
		[isSelected],
	);

	const fileCount = useMemo(
		() => countSelectedVisibleEntries(visibleContent.items, extendedMode, isFileSelected),
		[visibleContent.items, extendedMode, isFileSelected],
	);

	const healthcheckPending =
		publishHealthStatus === RequestStatus.Init || publishHealthStatus === RequestStatus.Loading;
	const isProtectedBranch = !healthcheckPending && publishHealth?.code === PublishHealthcheckCode.ProtectedBranch;
	const hasGitConflicts = !healthcheckPending && publishHealth?.code === PublishHealthcheckCode.HasGitConflicts;

	const hasChanges = visibleContent.items.length > 0;
	const isTreeLoading = !diffTree?.data && isEntriesLoading;
	const canDiscard = selectedFiles.size > 0 && !isPublishing && !isEntriesLoading && isEntriesReady;
	const selectedFilesReady = selectedFiles.size > 0 && isEntriesReady && !isEntriesLoading;

	if (isTreeLoading) return <Loader className="py-6" size="3xl" />;

	if (!hasChanges)
		return (
			<PanelEmptyState>
				<PanelEmptyStateIcon icon="circle-check" />
				<PanelEmptyStateTitle>{t("git.publish.empty-state.title")}</PanelEmptyStateTitle>
				<PanelEmptyStateDescription className="max-w-64">
					{t("git.publish.empty-state.description")}
				</PanelEmptyStateDescription>
			</PanelEmptyState>
		);

	return (
		<div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
			<div className="mb-2">
				<PublishSelectAllRow
					canDiscard={canDiscard}
					isSelectedAll={isSelectedAll}
					onDiscardAll={() => void discardPaths()}
					onSelectAll={selectAll}
					overview={visibleContent.overview}
				/>
			</div>
			<ScrollShadowContainer className="flex min-h-0 flex-1 flex-col" style={{ scrollbarWidth: "none" }}>
				<PublishTree
					activePath={activePath}
					canDiscard={canDiscard}
					entries={visibleContent.items}
					isSelected={isItemSelected}
					onDiscard={onDiscardItem}
					onOpen={onOpenItem}
					onSelect={onSelectItem}
				/>
			</ScrollShadowContainer>
			<PublishFooter
				fileCount={fileCount}
				hasGitConflicts={hasGitConflicts}
				isInputDisabled={
					isProtectedBranch ||
					healthcheckPending ||
					isDiscarding ||
					isPublishing ||
					!isEntriesReady ||
					hasGitConflicts
				}
				isProtectedBranch={isProtectedBranch}
				isPublishDisabled={healthcheckPending || isDiscarding || isPublishing || !selectedFilesReady}
				isPublishing={isPublishing}
				message={visibleContent.message}
				onMessageChange={setMessage}
				onPublish={() => void publishCurrentContent()}
			/>
		</div>
	);
};
