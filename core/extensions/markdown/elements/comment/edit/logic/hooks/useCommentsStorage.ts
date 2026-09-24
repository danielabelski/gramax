import ArticleUpdaterService from "@components/Article/ArticleUpdater/ArticleUpdaterService";
import FetchService from "@core-ui/ApiServices/FetchService";
import type { CommentBlock } from "@core-ui/CommentBlock";
import ApiUrlCreator from "@core-ui/ContextServices/ApiUrlCreator";
import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useRef } from "react";

const useCommentsStorage = (editor: Editor, articlePath?: string) => {
	const apiUrlCreator = ApiUrlCreator.value;
	const abortControllerRef = useRef<AbortController | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: apiUrlCreator is a context service, but it does change with the article — reload when it does
	const load = useCallback(
		async (updatedArticlePath?: string) => {
			if (!editor || editor.isDestroyed) return;
			const requestArticlePath = updatedArticlePath ?? articlePath;
			abortControllerRef.current?.abort();
			const abortController = new AbortController();
			abortControllerRef.current = abortController;

			try {
				const res = await FetchService.fetch<Record<string, CommentBlock>>(
					apiUrlCreator.getAllComments(requestArticlePath),
					undefined,
					undefined,
					undefined,
					false,
					undefined,
					abortController.signal,
				);
				if (!res.ok || editor.isDestroyed || abortController.signal.aborted) return;
				if (articlePath && requestArticlePath !== articlePath) return;

				const comments = await res.json();
				editor.storage.comment.comments = new Map(Object.entries(comments ?? {}));
				editor.storage.comment.deleted = new Map();
			} catch (error) {
				if (!abortController.signal.aborted) throw error;
			} finally {
				if (abortControllerRef.current === abortController) abortControllerRef.current = null;
			}
		},
		[editor, apiUrlCreator, articlePath],
	);

	useEffect(() => {
		void load();

		const unsubscribe = ArticleUpdaterService.onUpdated(
			(data) => void load(articlePath ? data.articleProps.ref.path : undefined),
		);
		return () => {
			unsubscribe();
			abortControllerRef.current?.abort();
		};
	}, [load, articlePath]);
};

export default useCommentsStorage;
