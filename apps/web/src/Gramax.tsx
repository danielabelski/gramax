import { type Environment, getExecutingEnvironment } from "@app/resolveModule/env";
import ContextProviders from "@components/ContextProviders";
import { WebPage } from "@components/Pages/components/WebPage";
import type { PageProps } from "@components/Pages/models/Pages";
import ErrorBoundary from "@ext/errorHandlers/client/components/ErrorBoundary";
import { type Dispatch, memo, type SetStateAction, useCallback } from "react";

export type GramaxData = Readonly<PageProps & { path: string }>;

interface GramaxProps {
	data: GramaxData;
	viewKey: string;
	refresh?: () => Promise<void>;
	setData: Dispatch<SetStateAction<GramaxData>>;
	platform?: Environment;
}

const Gramax = ({ data, viewKey, refresh, setData, platform }: GramaxProps) => {
	const clearData = useCallback(() => {
		const prev = data;
		setTimeout(() => setData((data) => (data === prev ? null : data)), 500);
	}, [data, setData]);

	return (
		<ContextProviders
			clearData={clearData}
			pageProps={data}
			platform={platform || getExecutingEnvironment()}
			refreshPage={refresh}
		>
			<ErrorBoundary context={data.context}>
				<WebPage data={data} viewKey={viewKey} />
			</ErrorBoundary>
		</ContextProviders>
	);
};

export default memo(Gramax, (prev, next) => {
	return prev.data === next.data && prev.viewKey === next.viewKey;
});
