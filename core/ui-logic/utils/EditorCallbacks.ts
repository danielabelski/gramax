import type { UpdateItemPropsResult } from "@app/commands/item/updateProps";
import type { Router } from "@core/Api/Router";
import { uniqueName } from "@core/utils/uniqueName";
import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import FetchService from "@core-ui/ApiServices/FetchService";
import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import type { ResourceServiceType } from "@core-ui/ContextServices/ResourceService/ResourceService";
import type { BaseEditorContext, EditorContext, EditorPasteHandler } from "@core-ui/stores/EditorStore";
import { span } from "@ext/loggers/opentelemetry";
import { paste } from "@ext/markdown/elements/copyArticles/handlers/paste";
import imageHandlePaste from "@ext/markdown/elements/image/edit/logic/imageHandlePaste";
import NavigationEvents, { type ItemRenamePatch } from "@ext/navigation/NavigationEvents";
import { useCallback } from "react";

export const createHandlePasteCallback = (resourceService: ResourceServiceType): EditorPasteHandler => {
	return (view, event, _slice, apiUrlCreator, articleProps, catalogProps) => {
		if (!event.clipboardData) return false;
		if (event.clipboardData.files.length !== 0)
			return imageHandlePaste(view, event, articleProps.fileName, resourceService);

		return paste({ view, event, apiUrlCreator, resourceService, catalogProps });
	};
};

export const createOnUpdateCallback = (): ((editorContext: EditorContext) => Promise<void>) => {
	return useCallback(async (editorContext: EditorContext) => {
		const { editor, apiUrlCreator } = editorContext;
		const json = editor.getJSON();
		json.content.shift();
		const articleContentEdit = JSON.stringify(json);
		const url = apiUrlCreator.updateArticleContent();
		await FetchService.fetch(url, articleContentEdit, MimeTypes.json);
	}, []);
};

export const createUpdateTitleFunction = () => {
	return async (context: BaseEditorContext, router: Router, title: string, fileName?: string) => {
		const { articleProps, apiUrlCreator } = context;

		// An untranslated stub has no title (`null`, only `external` names it), and the editor shows the
		// same as an empty first line. Callers compare with `!==`, so `null` vs "" reads as an edit here —
		// and the write puts an empty file with `external` in its frontmatter on disk.
		if (!fileName && (articleProps.title ?? "") === title) return;

		articleProps.title = title;
		// Not written into the shared props: a failed request would leave the article naming a file
		// that does not exist.
		const requestedFileName = fileName
			? uniqueName(
					fileName,
					await GetBrotherFileNames(articleProps.ref.path, apiUrlCreator, articleProps.fileName, fileName),
				)
			: articleProps.fileName;

		const url = apiUrlCreator.updateItemProps(articleProps.ref.path, requestedFileName);
		const res = await FetchService.fetch(
			url,
			JSON.stringify({
				...articleProps,
				fileName: requestedFileName,
				properties: context.propertyService?.articleProperties.map((prop) => ({
					id: prop.id,
					value: prop.value,
				})),
			}),
			MimeTypes.json,
		);

		if (!res.ok) return;

		if (fileName) {
			const data: UpdateItemPropsResult = await res.json();
			if (!data?.pathname) return;
			const { pathname, ref, fileName: savedFileName, logicPath } = data;
			const patch: ItemRenamePatch = { ref, pathname, fileName: savedFileName, logicPath, title };

			// Announced before the url is replaced, so the page follows the move in place: re-reading it
			// for the new path would remount the article view and take the open editor with it.
			const mutable: { preventGoto?: boolean } = {};
			await NavigationEvents.emit("item-rename", {
				from: articleProps.ref,
				patch,
				view: context.view ?? null,
				mutable,
			}).catch((error) => span()?.recordException(error as Error));

			// The file has already moved; an address left behind 404s on the next reload.
			if (!mutable.preventGoto) await router.pushPath(pathname, undefined, { replace: true });
			return patch;
		}

		const patch: ItemRenamePatch = {
			ref: articleProps.ref,
			pathname: articleProps.pathname,
			fileName: requestedFileName,
			logicPath: articleProps.logicPath,
			title,
		};
		await NavigationEvents.emit("item-rename", {
			from: articleProps.ref,
			patch,
			view: context.view ?? null,
			mutable: {},
		}).catch((error) => span()?.recordException(error as Error));

		return patch;
	};
};

const GetBrotherFileNames = async (
	articlePath: string,
	apiUrlCreator: ApiUrlCreator,
	fileName?: string,
	newFileName?: string,
): Promise<string[]> => {
	const response = await FetchService.fetch(
		apiUrlCreator.getArticleBrotherFileNames(articlePath, fileName, newFileName),
	);
	if (!response.ok) return;
	const data = (await response.json()) as string[];
	return data;
};
