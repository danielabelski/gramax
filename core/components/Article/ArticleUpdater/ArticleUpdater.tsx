import type { ClientItemRef } from "@core/SitePresenter/SitePresenter";
import type { EditArticlePageData } from "@core/SitePresenter/types/ArticlePage";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import ResourceService from "@core-ui/ContextServices/ResourceService/ResourceService";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { useArticlePropsStore } from "@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider";
import { getEditorStore } from "@core-ui/stores/EditorStore";
import { useItemLinksStore } from "@core-ui/stores/ItemLinksStore/ItemLinksStore.provider";
import isSameItemRef from "@core-ui/utils/isSameItemRef";
import { useCallback, useEffect, useRef } from "react";
import ArticleUpdaterService from "./ArticleUpdaterService";
import { isUnchangedContent } from "./isUnchangedContent";
import parseArticleContent from "./parseArticleContent";

const ArticleUpdater = ({ children }: { children: JSX.Element }) => {
	const { isTauri } = usePlatform();
	const resourceService = ResourceService.value;
	const isReadOnly = PageDataContextService.value.conf.isReadOnly;

	const updateArticleProps = useArticlePropsStore((state) => state.update);
	const articleOnScreen = useRef<ClientItemRef>(null);
	articleOnScreen.current = useArticlePropsStore((state) => state.data.ref);
	const setItemLinks = useItemLinksStore((state) => state.setItemLinks);
	const onUpdate = useCallback(
		(newData: EditArticlePageData) => {
			if (!newData || typeof newData.content !== "string") return;
			updateArticleProps({ ...newData.articleProps });
			if (newData.itemLinks) setItemLinks(newData.itemLinks);
			resourceService.clear();
			const editor = getEditorStore().editor;
			// isDestroyed, not just null: tiptap's destroy() nulls commandManager and schema, so
			// chain() below would throw on a destroyed instance. The store can still hold one —
			// switching the article view (ArticleViewService.setLoadingView) unmounts the editor
			// while this update is already in flight.
			if (!editor || editor.isDestroyed) return;
			const parsed = parseArticleContent(newData.content);
			if (!parsed) return;
			// Skip the focus-resetting setContent when nothing actually changed — backstop
			// against a self-write echo that reaches the active article (structural files like
			// _index.md are exempt from watcher self-write suppression, so editing a section
			// landing article echoes back here; a genuine external edit yields a different doc
			// and still applies).
			if (isUnchangedContent(editor, parsed)) return;
			// Clear history to avoid nodes with resources don't be error on undo/redo.
			// `emitUpdate: false`: this content came from a page read, so it is already on disk —
			// an emitted update would look like typing and save it back, over whatever the write
			// that prompted the read had put there. `articleProps` above carries the fresh tocItems.
			editor.chain().clearHistory().setContent(parsed, { emitUpdate: false }).run();
		},
		[updateArticleProps, setItemLinks],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: it's ok
	useEffect(() => {
		ArticleUpdaterService.bindOnUpdate(onUpdate, (ref) => isSameItemRef(ref, articleOnScreen.current));
	}, []);

	if (isReadOnly || !isTauri) return children;

	return children;
};

export default ArticleUpdater;
