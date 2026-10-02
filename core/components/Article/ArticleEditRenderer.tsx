import { NEW_ARTICLE_REGEX } from "@app/config/const";
import type { ArticleComponentProps } from "@components/Article/Article";
import { ArticleParent } from "@components/Article/ArticleRenderer";
import { useRouter } from "@core/Api/useRouter";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import ResourceService from "@core-ui/ContextServices/ResourceService/ResourceService";
import { useArticleViewKey } from "@core-ui/ContextServices/views/articleView/ArticleViewKey";
import Workspace from "@core-ui/ContextServices/Workspace";
import { useDebounce } from "@core-ui/hooks/useDebounce";
import useRenameAwareWrites from "@core-ui/hooks/useRenameAwareWrites";
import useWatch from "@core-ui/hooks/useWatch";
import { transliterate } from "@core-ui/languageConverter/transliterate";
import { useArticlePropsStore } from "@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider";
import type { BaseEditorContext } from "@core-ui/stores/EditorStore";
import {
	createHandlePasteCallback,
	createOnUpdateCallback,
	createUpdateTitleFunction,
} from "@core-ui/utils/EditorCallbacks";
import { createOpenApiTocItemsResolver } from "@ext/markdown/elements/openApi/edit/logic/OpenApiTocItemsStore";
import {
	OpenApiTocItemsStoreProvider,
	useOpenApiTocItemsStore,
} from "@ext/markdown/elements/openApi/edit/logic/OpenApiTocItemsStore.provider";
import getTocItems, { getLevelTocItemsByJSONContent } from "@ext/navigation/article/logic/createTocItems";
import PropertyService from "@ext/properties/components/PropertyService";
import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useMemo, useRef } from "react";
import ContentEditor from "../../extensions/markdown/core/edit/components/ContentEditor";
import getExtensions from "../../extensions/markdown/core/edit/logic/getExtensions";
import { useArticleTitleUpdateQueue } from "./ArticleTitleUpdateQueue";
import ArticleUpdater from "./ArticleUpdater/ArticleUpdater";

export const ArticleEditRenderer = ({ data: { content } }: ArticleComponentProps<"edit">) => {
	const { articleProps, updateArticleProps } = useArticlePropsStore((state) => ({
		articleProps: state.data,
		updateArticleProps: state.update,
	}));

	const resourceService = ResourceService.value;
	const workspace = Workspace.current();
	const isGES = !!workspace?.enterprise?.gesUrl;
	const gesModules = workspace?.enterprise?.modules;

	const router = useRouter();
	const apiUrlCreator = ApiUrlCreatorService.value;
	const { openApiTocItemsData } = useOpenApiTocItemsStore((store) => ({
		openApiTocItemsData: store.data,
	}));

	const propertyService = PropertyService.value;

	const view = useArticleViewKey();
	const { articlePropsRef, apiUrlCreatorRef, sendContext, trackRename, ownPathRef } = useRenameAwareWrites({
		articleProps,
		updateArticleProps,
		apiUrlCreator,
		propertyService,
		view,
	});

	const editorUpdateContent = createOnUpdateCallback();
	const updateTitle = useMemo(() => createUpdateTitleFunction(), []);
	const editorHandlePaste = createHandlePasteCallback(resourceService);

	// Title the article had when it was opened. A placeholder file (untitled/new_article_*)
	// is renamed to the title slug only after the user actually edits the title — cloned
	// catalogs may legitimately contain such files, and renaming them on mere focus loss
	// leaves the rest of the UI holding a stale article path.
	// Which article this editor was opened for. Taken once: `ref.path` is an address, and a rename
	// moves it under the same open article — read live, it would tell the document sync that another
	// article arrived, and the sync replaces the whole editor state. Another article remounts this.
	const articleId = useRef(articleProps.ref.path).current;

	const loadedTitleRef = useRef(articleProps.title);
	useWatch(() => {
		loadedTitleRef.current = articleProps.title;
	}, [articleProps.ref.path]);

	const updateContent = useCallback(
		async (editor: Editor) => {
			const { apiUrlCreator, articleProps } = await sendContext();
			await editorUpdateContent({ editor, apiUrlCreator, articleProps });
		},
		[editorUpdateContent, sendContext],
	);

	const { start: debouncedUpdateContent, cancel: cancelDebouncedUpdateContent } = useDebounce(updateContent, 500);
	const enqueueTitleUpdate = useArticleTitleUpdateQueue(async (newTitle, fileName) => {
		// Taken only after earlier title updates finish, so a rename always uses the latest path.
		const context = await sendContext();
		const update = updateTitle(context, router, newTitle, fileName);
		await (fileName ? trackRename(update) : update);
	});

	const { start: debouncedUpdateTitle, cancel: cancelDebouncedUpdateTitle } = useDebounce(
		async (newTitle: string, fileName?: string) => {
			await enqueueTitleUpdate(newTitle, fileName);
		},
		500,
	);

	useWatch(() => {
		if (articleProps.ref.path === ownPathRef.current) return;
		ownPathRef.current = articleProps.ref.path;
		cancelDebouncedUpdateTitle();
		enqueueTitleUpdate.drop();
	}, [articleProps.ref.path]);

	// Pending saves are cancelled when the article closes, and only then. The file path as a dependency
	// would mean "another article", but it also changes under the same one — on rename — and the
	// cleanup would then cancel the save of the text just typed. Another article remounts this anyway.
	// biome-ignore lint/correctness/useExhaustiveDependencies: expected
	useEffect(() => {
		return () => {
			if (window.debug) window.debug.forceSave = null;
			cancelDebouncedUpdateContent();
			cancelDebouncedUpdateTitle();
		};
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: refs are read here, not depended on
	const onTitleNeedsUpdate = useCallback(
		({ newTitle }: { newTitle: string } & BaseEditorContext) => {
			cancelDebouncedUpdateTitle();
			const maybeKebabName =
				newTitle &&
				newTitle !== loadedTitleRef.current &&
				NEW_ARTICLE_REGEX.test(articlePropsRef.current?.fileName)
					? transliterate(newTitle, { kebab: true, maxLength: 50 })
					: undefined;

			if (maybeKebabName || newTitle !== articlePropsRef.current?.title)
				void enqueueTitleUpdate(newTitle, maybeKebabName);
		},
		[cancelDebouncedUpdateTitle, enqueueTitleUpdate],
	);

	const onContentUpdate = ({ editor }: { editor: Editor }) => {
		const tocItems = getTocItems(
			getLevelTocItemsByJSONContent(editor.state.doc, createOpenApiTocItemsResolver(openApiTocItemsData)),
		);
		if (tocItems) updateArticleProps({ tocItems: [...tocItems] });

		if (typeof window !== "undefined" && window.debug) window.debug.forceSave = () => updateContent(editor);

		debouncedUpdateContent(editor);
		if (articleProps.title !== editor.state.doc.firstChild.textContent) {
			debouncedUpdateTitle(editor.state.doc.firstChild.textContent);
		}
	};

	// A new array here rebuilds the editor from scratch (ContentEditor keys useEditor on it), so it
	// must track what the extensions are actually built from — not the article path. Opening another
	// article remounts this component anyway; a rename changes the path under the same open editor.
	const extensions = useMemo(
		() =>
			getExtensions({
				includeResources: true,
				includeQuestions: isGES && gesModules?.quiz,
				...(articleProps.template && { isTemplateInstance: true }),
			}),
		[articleProps.template, isGES, gesModules?.quiz],
	);

	return (
		<ArticleUpdater>
			<ArticleParent>
				<ContentEditor
					apiUrlCreatorRef={apiUrlCreatorRef}
					articleId={articleId}
					articlePropsRef={articlePropsRef}
					content={content}
					extensions={extensions}
					handlePaste={editorHandlePaste}
					onTitleLoseFocus={onTitleNeedsUpdate}
					onUpdate={onContentUpdate}
				/>
			</ArticleParent>
		</ArticleUpdater>
	);
};

export default (props: ArticleComponentProps<"edit">) => (
	<OpenApiTocItemsStoreProvider>
		<ArticleEditRenderer {...props} />
	</OpenApiTocItemsStoreProvider>
);
