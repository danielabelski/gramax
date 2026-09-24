import getApp from "@app/web/app";
import getCommands from "@app/web/commands";
import type Query from "@core/Api/Query";
import { parserQuery } from "@core/Api/Query";
import { Router as BaseRouter } from "@core/Api/Router";
import RouterPathProvider from "@core/RouterPath/RouterPathProvider";
import type { ArticlePageData } from "@core/SitePresenter/types/ArticlePage";
import getPageTitle from "@core-ui/getPageTitle";
import { emitApiEvent } from "@core-ui/hooks/useApi";
import isSameItemRef from "@core-ui/utils/isSameItemRef";
import type DefaultError from "@ext/errorHandlers/logic/DefaultError";
import { getQueryForDiffFromCatalogName } from "@ext/git/actions/Revisions/logic/utils/getQueryForDiffFromCatalogName";
import Localizer from "@ext/localization/core/Localizer";
import t from "@ext/localization/locale/translate";
import { span } from "@ext/loggers/opentelemetry";
import NavigationEvents from "@ext/navigation/NavigationEvents";
import { showPluginCompatibilityToast } from "@plugins/components/showPluginCompatibilityToast";
import { loadRouteWorkspacePlugins } from "@plugins/index";
import { toast } from "@ui-kit/Toast";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { GramaxData } from "../Gramax";
import useLocation from "../logic/Api/useLocation";

const getData = async (route: string, query: Query) => {
	const app = await getApp();
	const commands = getCommands(app);
	await loadRouteWorkspacePlugins({
		route,
		app,
		commands,
		onPluginLoadError: (pluginName) =>
			toast(t("plugins.messages.load-error").replace("{name}", pluginName), { status: "error" }),
		onPluginCompatibilityIssue: (issue) => showPluginCompatibilityToast(issue.pluginName),
		onError: (error) => span()?.recordException(error as Error),
	});
	const language = RouterPathProvider.parsePath(route).language;
	const ctx = await app.contextFactory.fromWeb({
		language,
		query,
	});

	const optionsForDiff = getQueryForDiffFromCatalogName(route, query);
	const mode = query.mode as ArticlePageData["mode"];

	const data = await commands.page.getPageData.do({
		ctx,
		path: route,
		options: {
			mode,
			...(optionsForDiff ? optionsForDiff : {}),
		},
	});
	emitApiEvent("on-did-command", { command: commands.page.getPageData.path, args: { path: route }, result: null });
	return data;
};

// used for handling opening urls of cloning catalogs; we don't want to open them yet
const filterOutPageData = (data: ArticlePageData, setLocation: (path: string) => void) => {
	if (data?.catalogProps?.link?.isCloning) {
		setLocation("/");
		return true;
	}

	return false;
};

const getIsPreventNextPushRefresh = () => {
	if (BaseRouter.preventNextPushRefresh) {
		BaseRouter.preventNextPushRefresh = false;
		return true;
	}
	return false;
};

/**
 * The open page: what is on screen, which view holds it, and when it is re-read. A rename is the one
 * move that changes the address without changing the page — the editor, its caret and the text typed
 * since the title have to survive it — so it is answered here in place of a read.
 */
const usePageData = () => {
	const [path, setLocation, query] = useLocation();
	const [data, setData] = useState<GramaxData>();
	const [error, setError] = useState<DefaultError>();
	const refreshCounterRef = useRef(0);
	// A number, not a path: `untitled.md` comes back for the next new article, and a path-shaped key
	// would call the two views one and keep the first article's editor on the second.
	const viewGenRef = useRef(0);
	const [viewKey, setViewKey] = useState<string>(null);
	// The url a rename moved the page to. Not a flag: a rename to the same name changes no address,
	// and a flag armed for a move that never happened would swallow the next real navigation.
	const movedToRef = useRef<string>(null);

	// Written in a layout effect: a render React throws away must not leave data here.
	const dataRef = useRef<GramaxData>(null);
	const viewKeyRef = useRef<string>(null);
	const pathRef = useRef(path);
	useLayoutEffect(() => {
		dataRef.current = data;
		viewKeyRef.current = viewKey;
		pathRef.current = path;
	});

	useEffect(() => {
		const token = NavigationEvents.on("item-rename", ({ from, patch, view, mutable }) => {
			const shown = dataRef.current;
			// The rename is not this page's: another article is on screen, the reader is already on the
			// way to one (its read is in flight and must land), or the path in `from` has been reused by
			// a newer view since the rename went out.
			const ours =
				shown?.page === "article" &&
				isSameItemRef(shown.data.articleProps?.ref, from) &&
				(view === null || view === viewKeyRef.current) &&
				pathRef.current === shown.path;
			if (!ours) {
				mutable.preventGoto = true;
				return;
			}

			// The command spells the address without a leading slash, the router keeps one. Brought to
			// the router's spelling here, where the command's answer enters the page; the props keep
			// the command's spelling, because they are sent back to it as such.
			const pathname = Localizer.sanitize(patch.pathname);

			if (shown.path !== pathname) movedToRef.current = pathname;
			// A read already in flight for the old url is obsolete — retire it before it lands.
			refreshCounterRef.current++;
			setData({
				...shown,
				path: pathname,
				data: { ...shown.data, articleProps: { ...shown.data.articleProps, ...patch } },
			});
		});
		return () => NavigationEvents.off(token);
	}, []);

	const refresh = useCallback(async () => {
		const requestId = ++refreshCounterRef.current;
		window.onNavigate?.(path);
		try {
			const data = await getData(path, parserQuery(query));

			if (requestId !== refreshCounterRef.current) return;

			if (getIsPreventNextPushRefresh() || filterOutPageData(data?.data as ArticlePageData, setLocation)) return;

			// A read of the article already on screen keeps its view — remounting would drop the caret.
			const shown = dataRef.current;
			const shownRef = shown?.page === "article" ? shown.data.articleProps?.ref : null;
			const nextRef = (data?.data as ArticlePageData)?.articleProps?.ref;
			if (!isSameItemRef(shownRef, nextRef)) setViewKey(String(++viewGenRef.current));
			setData({ path, ...data });
		} catch (err) {
			if (requestId !== refreshCounterRef.current) return;
			console.error("failed to get page data", err);
			setError(err);
		}
	}, [path, setLocation, query]);

	if (typeof window !== "undefined") {
		window.navigateTo = useCallback(
			(url: string) => {
				window.resetIsFirstLoad();
				if (url === path) {
					void refresh();
				} else {
					setData(undefined);
					window.resetIsFirstLoad();
					setLocation(url);
				}
			},
			[path, refresh, setLocation],
		);
	}

	// The url a rename just replaced is already on screen, content and view included: reading it again
	// would rebuild the editor from the new content and take the caret with it. Cleared either way — a
	// leftover marker must never decide anything about a later navigation.
	useEffect(() => {
		const moved = movedToRef.current === path;
		movedToRef.current = null;
		if (moved) return;
		void refresh();
	}, [refresh, path]);

	useEffect(() => {
		if (data) document.title = getPageTitle(data);
	}, [data]);

	return { data, error, viewKey, refresh, setData, setLocation };
};

export default usePageData;
