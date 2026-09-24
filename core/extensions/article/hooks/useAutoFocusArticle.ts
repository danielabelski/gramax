import ArticleRefService from "@core-ui/ContextServices/ArticleRef";
import { useArticlePropsStore } from "@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider";
import { useEditorStore } from "@core-ui/stores/EditorStore";
import { useLayoutEffect } from "react";

export const useAutoFocusArticle = () => {
	const articleRef = ArticleRefService.value;
	const pathname = useArticlePropsStore((state) => state.data?.pathname);
	const editor = useEditorStore((state) => state.editor);

	// biome-ignore lint/correctness/useExhaustiveDependencies: expected
	useLayoutEffect(() => {
		const activeElementBeforeDelay = document.activeElement;
		let focusFrame: number | undefined;
		const paintFrame = requestAnimationFrame(() => {
			focusFrame = requestAnimationFrame(() => {
				const article = articleRef.current;
				if (!article) return;

				const activeElement = document.activeElement;
				const editableEditor = editor && !editor.isDestroyed && editor.isEditable ? editor : null;
				if (activeElement && article.contains(activeElement)) {
					if (activeElement !== article || !editableEditor) return;
				}
				if (activeElement !== activeElementBeforeDelay && activeElement !== document.body) return;

				if (editableEditor) {
					editableEditor.commands.focus("start", { scrollIntoView: false });
					return;
				}

				article.focus({ preventScroll: true });
			});
		});

		return () => {
			cancelAnimationFrame(paintFrame);
			if (focusFrame !== undefined) cancelAnimationFrame(focusFrame);
		};
	}, [pathname, editor]);
};
