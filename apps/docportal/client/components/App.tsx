import ContextProviders from "@components/ContextProviders";
import type { PageProps } from "@components/Pages/models/Pages";
import useSessionExpirationToast from "@ext/enterprise/components/SingInOut/hooks/useSessionExpirationToast";
import ErrorBoundary from "@ext/errorHandlers/client/components/ErrorBoundary";
import { useApplyTheme } from "@ext/Theme/utils";
import { usePluginEvent } from "@plugins/api/events";
import { Toaster } from "@ui-kit/Toast";
import { useCallback, useEffect } from "react";
import { Router } from "wouter";
import { DocportalPage } from "../../../../core/components/Pages/components/DocportalPage";
import AppError from "../../../web/src/components/Atoms/AppError";
import useLocation from "../../../web/src/logic/Api/useLocation";
import { getBasePath, prependBasePath, stripBasePath } from "../logic/basePath";
import { usePortalPageData } from "../logic/usePortalPageData";

interface AppProps {
	initialData: PageProps;
}

export const App = ({ initialData }: AppProps) => {
	const basePath = getBasePath();
	const [rawPath, rawSetLocation] = useLocation();
	const path = stripBasePath(rawPath);
	const setLocation = useCallback(
		(url: string, opts?: { replace?: boolean }) => rawSetLocation(prependBasePath(url), opts),
		[rawSetLocation],
	);
	const { pageData, error, refresh } = usePortalPageData(path, initialData);

	const navigateTo = useCallback(
		(url: string) => {
			if (typeof window === "undefined") return;
			window.resetIsFirstLoad?.();
			if (url === path) void refresh();
			else setLocation(url);
		},
		[path, refresh, setLocation],
	);

	useEffect(() => {
		if (typeof window !== "undefined") {
			window.navigateTo = navigateTo;
		}
	}, [navigateTo]);

	useSessionExpirationToast(pageData.context?.user?.sessionExpired);

	useApplyTheme();
	usePluginEvent("app:open", { ...pageData, path });
	usePluginEvent("app:close");

	if (error) {
		return <AppError error={error} />;
	}

	return (
		<>
			<Toaster />
			<ContextProviders pageProps={pageData} platform="next" refreshPage={refresh}>
				<ErrorBoundary context={pageData.context}>
					<Router base={basePath} hook={() => [path, setLocation]}>
						<DocportalPage data={pageData} />
					</Router>
				</ErrorBoundary>
			</ContextProviders>
		</>
	);
};
