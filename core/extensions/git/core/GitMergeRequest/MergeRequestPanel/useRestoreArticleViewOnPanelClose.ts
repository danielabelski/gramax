import ArticleUpdaterService from "@components/Article/ArticleUpdater/ArticleUpdaterService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import ArticleViewService from "@core-ui/ContextServices/views/articleView/ArticleViewService";
import { MERGE_REQUEST_PANEL_ID } from "@ext/git/core/GitMergeRequest/constants";
import { useFloatingPanelStore } from "@ui-kit/FloatingPanel";
import { useEffect, useRef } from "react";

export const useRestoreArticleViewOnPanelClose = () => {
	const isOpen = useFloatingPanelStore((state) => state.panels[MERGE_REQUEST_PANEL_ID]?.isOpen ?? false);
	const apiUrlCreator = ApiUrlCreatorService.value;
	const apiUrlCreatorRef = useRef(apiUrlCreator);
	const hasBeenOpenedRef = useRef(false);
	apiUrlCreatorRef.current = apiUrlCreator;

	useEffect(() => {
		if (isOpen) {
			hasBeenOpenedRef.current = true;
			return;
		}
		if (!hasBeenOpenedRef.current) return;
		hasBeenOpenedRef.current = false;
		if (ArticleViewService.isDefaultView()) return;

		ArticleViewService.setDefaultView();
		void ArticleUpdaterService.update(apiUrlCreatorRef.current).then(() => refreshPage());
	}, [isOpen]);
};
