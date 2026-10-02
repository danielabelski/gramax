import type { ClientArticleProps } from "@core/SitePresenter/SitePresenter";
import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import useWatch from "@core-ui/hooks/useWatch";
import isSameItemRef from "@core-ui/utils/isSameItemRef";
import { trackRenameInFlight, whenRenameSettled } from "@core-ui/utils/renameInFlight";
import NavigationEvents, { type ItemRenamePatch } from "@ext/navigation/NavigationEvents";
import type { PropertyService } from "@ext/properties/components/PropertyService";
import { useCallback, useEffect, useRef } from "react";

/**
 * Keeps the open article's address current for writes, across the rename that changes it. While a
 * rename is in flight the client knows no address at all — the file has already moved on disk and
 * the new path arrives with the response — and a write sent into that window is silently dropped.
 */
const useRenameAwareWrites = ({
	articleProps,
	updateArticleProps,
	apiUrlCreator,
	propertyService,
	view,
}: {
	articleProps: ClientArticleProps;
	updateArticleProps: (patch: Partial<ClientArticleProps>) => void;
	apiUrlCreator: ApiUrlCreator;
	propertyService: PropertyService;
	/** The article view this editor lives in; renames of another view are not this article's. */
	view: string | null;
}) => {
	const apiUrlCreatorRef = useRef(apiUrlCreator);
	const articlePropsRef = useRef(articleProps);
	const propertyServiceRef = useRef(propertyService);
	const ownPathRef = useRef(articleProps.ref.path);

	useWatch(() => {
		apiUrlCreatorRef.current = apiUrlCreator;
		articlePropsRef.current = articleProps;
		propertyServiceRef.current = propertyService;
	}, [apiUrlCreator, articleProps, propertyService.articleProperties]);

	// Own renames only — the event is global. The view tells this article from another one that took
	// over the same path while the response was in flight; the ref check stays for emitters without a view.
	useEffect(() => {
		const token = NavigationEvents.on("item-rename", ({ from, patch, view: renamedView }) => {
			if (view !== null && renamedView !== view) return;
			if (!isSameItemRef(articlePropsRef.current?.ref, from)) return;
			articlePropsRef.current = { ...articlePropsRef.current, ...patch };
			ownPathRef.current = patch.ref.path;
			updateArticleProps(patch);
		});
		return () => NavigationEvents.off(token);
	}, [updateArticleProps, view]);

	// Writes wait for a rename — and only for that: ordinary saves never hold each other up. The new
	// address comes from the rename's own result: a write already waiting keeps waiting after this
	// editor unmounts, when the subscription above is gone. Creating an article waits on the same
	// rename, so it is published for everyone rather than kept in this hook.
	const trackRename = useCallback((rename: Promise<ItemRenamePatch | undefined>) => {
		const from = articlePropsRef.current?.ref?.path;
		trackRenameInFlight(
			rename.then(
				(patch) => {
					if (!patch) return undefined;
					articlePropsRef.current = { ...articlePropsRef.current, ...patch };
					ownPathRef.current = patch.ref.path;
					return from ? { from, to: patch.ref.path } : undefined;
				},
				// A failed rename is the caller's problem; waiters only care that it is over.
				() => undefined,
			),
		);
		return rename;
	}, []);

	// The address is taken at send time, not when the write was queued. The same path goes into the
	// url and into the body — the server resolves the article from the body.
	const sendContext = useCallback(async () => {
		await whenRenameSettled();
		const path = articlePropsRef.current?.ref?.path;
		return {
			apiUrlCreator: path ? apiUrlCreatorRef.current.fromNewArticlePath(path) : apiUrlCreatorRef.current,
			articleProps: articlePropsRef.current,
			propertyService: propertyServiceRef.current,
			view,
		};
	}, [view]);

	return { articlePropsRef, apiUrlCreatorRef, sendContext, trackRename, ownPathRef };
};

export default useRenameAwareWrites;
