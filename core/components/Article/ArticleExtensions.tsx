import ButtonStateService from "@core-ui/ContextServices/ButtonStateService/ButtonStateService";
import PageDataContext from "@core-ui/ContextServices/PageDataContext";
import { isActive } from "@core-ui/hooks/useAudioRecorder";
import useMediaQuery from "@core-ui/hooks/useMediaQuery";
import { useArticlePropsStore } from "@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider";
import { useEditorStore } from "@core-ui/stores/EditorStore";
import { cn } from "@core-ui/utils/cn";
import { cssMedia } from "@core-ui/utils/cssUtils";
import AudioRecorderService from "@ext/ai/components/Audio/AudioRecorderService";
import { ArticleAudioToolbar } from "@ext/ai/components/Audio/Toolbar";
import { useIsRevision } from "@ext/git/actions/Revisions/logic/hooks/useIsRevision";
import { useIsDiffView } from "@ext/git/core/Diff/logic/hooks/useIsDiffView";
import ToolbarMenu from "@ext/markdown/core/edit/components/Menu/Menus/Toolbar";
import ToolbarWrapper from "@ext/markdown/core/edit/components/Menu/ToolbarWrapper";
import { useToolbarViewport } from "@ext/markdown/core/edit/logic/Toolbar/useToolbarViewport";
import { useRef } from "react";
import { VIEWPORT_PADDING } from "../../ui-kit/lib/floating";

export const ARTICLE_TOOLBAR_POSITION_CLASS =
	"sticky inset-x-0 flex justify-center z-[var(--z-index-toolbar)] pointer-events-none px-2.5 md:px-0";
export const ARTICLE_TOOLBAR_MENU_CLASS = "flex justify-center rounded-lg";

const ArticleToolbar = () => {
	const editor = useEditorStore((s) => s.editor);
	const pageDataContext = PageDataContext.value;
	const isGramaxAiEnabled = pageDataContext?.conf?.ai?.enabled;

	const { recorderState } = AudioRecorderService.value;

	return (
		<div className="w-full" data-toolbar="bottom">
			{isActive(recorderState) && <ArticleAudioToolbar editor={editor} />}
			<div className={ARTICLE_TOOLBAR_MENU_CLASS}>
				<ButtonStateService.Provider editor={editor}>
					<ToolbarMenu editor={editor} isGramaxAiEnabled={isGramaxAiEnabled} />
				</ButtonStateService.Provider>
			</div>
		</div>
	);
};

const ArticleExtensions = () => {
	const isMobile = useMediaQuery(cssMedia.JSnarrow);
	const toolbarRef = useToolbarViewport();
	const containerRef = useRef<HTMLDivElement>(null);
	const articleErrorCode = useArticlePropsStore((state) => state.data?.errorCode);
	const isReadOnly = PageDataContext.value.conf.isReadOnly;
	const isDiffView = useIsDiffView();
	const isRevision = useIsRevision();
	const isSmallEditor = useEditorStore((s) => s.isSmallEditor);

	if (articleErrorCode || (isReadOnly && !isDiffView && !isRevision) || isSmallEditor) return null;
	return (
		<>
			{isMobile && <div className="h-[var(--keyboard-height, 0px)]" />}
			<div className={ARTICLE_TOOLBAR_POSITION_CLASS} style={{ bottom: VIEWPORT_PADDING }}>
				<ToolbarWrapper
					className="transition-all duration-500 sm:[&>div]:rounded-lg max-w-full w-full md:w-auto"
					ref={toolbarRef}
				>
					<div
						className={cn(
							"flex flex-col items-center gap-1 print:hidden",
							isMobile && "overflow-visible block gap-0 pb-0",
						)}
						ref={containerRef}
					>
						<ArticleToolbar />
					</div>
				</ToolbarWrapper>
			</div>
		</>
	);
};

export default ArticleExtensions;
