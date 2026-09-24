import type { ArticleComponentProps } from "@components/Article/Article";
import FileInput from "@components/Atoms/FileInput/FileInput";
import { useArticleWidthStyle } from "@components/Layouts/CatalogLayout/ArticleLayout/useArticleDimensions";
import FetchService from "@core-ui/ApiServices/FetchService";
import Method from "@core-ui/ApiServices/Types/Method";
import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import { useDebounce } from "@core-ui/hooks/useDebounce";
import { useArticlePropsStore } from "@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider";
import type { editor } from "monaco-editor";
import { useCallback, useLayoutEffect, useRef } from "react";

export const ArticleMarkdownRenderer = ({ data, isReadOnly }: ArticleComponentProps<"markdown">) => {
	const articleWidthStyle = useArticleWidthStyle();
	const apiUrlCreator = ApiUrlCreatorService.value;
	const apiUrlCreatorRef = useRef(apiUrlCreator);
	apiUrlCreatorRef.current = apiUrlCreator;

	const isTemplate = useArticlePropsStore((state) => !!state.data?.template);
	const content = data.content ?? "";
	const contentRef = useRef(content);
	contentRef.current = content;

	const editorRef = useRef<editor.IStandaloneCodeEditor>(null);
	const isContentSyncRef = useRef(false);

	const syncEditorContent = useCallback((editor: editor.IStandaloneCodeEditor) => {
		const content = contentRef.current;
		if (editor.getValue() === content) return;

		isContentSyncRef.current = true;
		try {
			editor.setValue(content);
		} finally {
			isContentSyncRef.current = false;
		}
	}, []);

	const onUpdateContent = useCallback(
		(content: string) => {
			void FetchService.fetch(
				apiUrlCreatorRef.current.setArticleContent(data.articleProps.ref.path),
				content,
				MimeTypes.text,
				Method.POST,
				false,
			);
		},
		[data.articleProps.ref.path],
	);

	const { start: debouncedUpdateContent } = useDebounce(onUpdateContent, 500);

	// biome-ignore lint/correctness/useExhaustiveDependencies: article path and content trigger a sync through contentRef
	useLayoutEffect(() => {
		if (!editorRef.current) return;
		syncEditorContent(editorRef.current);
	}, [data.articleProps.ref.path, content, syncEditorContent]);

	return (
		<div className="w-full">
			<div className="w-full h-full justify-self-center">
				<div
					className="w-[var(--article-content-wrapper-width)] ml-[calc((var(--article-content-wrapper-width)-100%)/-2)]"
					style={articleWidthStyle}
				>
					<FileInput
						height={"85dvh"}
						onChange={(value) => {
							if (isContentSyncRef.current) return;
							if (typeof window !== "undefined" && window.debug) {
								window.debug.forceSave = () => onUpdateContent(value);
							}

							debouncedUpdateContent(value);
						}}
						onMount={(editor) => {
							editorRef.current = editor;
							syncEditorContent(editor);
							// https://github.com/microsoft/monaco-editor/issues/4448
							editor.updateOptions({ glyphMargin: false });
						}}
						options={{
							readOnly: isReadOnly || isTemplate,
							glyphMargin: false,
						}}
						style={{ padding: "0" }}
						theme={{ dark: "article-dark", light: "light" }}
						value={content}
					/>
				</div>
			</div>
		</div>
	);
};
