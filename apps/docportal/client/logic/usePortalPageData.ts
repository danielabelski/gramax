import type { PageProps } from "@components/Pages/models/Pages";
import getPageTitle from "@core-ui/getPageTitle";
import type DefaultError from "@ext/errorHandlers/logic/DefaultError";
import Localizer from "@ext/localization/core/Localizer";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBasePath } from "./basePath";

export const fetchPageData = async (path: string): Promise<PageProps> => {
	const URLParams = new URLSearchParams();
	URLParams.set("path", path);
	URLParams.set("mode", "read");

	const language = Localizer.extract(path);
	const res = await fetch(`${getBasePath()}/api/page/getPageData?${URLParams.toString()}`, {
		headers: language ? { "x-gramax-language": language } : undefined,
	});
	if (!res.ok) throw new Error(`Failed to fetch page data: ${res.status}`);
	return res.json();
};

/** The page on screen at `path`: the server rendered the first one, every later one is fetched. */
export const usePortalPageData = (path: string, initialData: PageProps) => {
	const isFirstLoad = useRef<boolean>(true);
	const lastRequest = useRef(0);
	const [pageData, setPageData] = useState<PageProps>(initialData);
	const [error, setError] = useState<DefaultError>(null);

	const refresh = useCallback(async () => {
		const request = ++lastRequest.current;
		if (typeof window !== "undefined") window.onNavigate?.(path);
		try {
			const newData = await fetchPageData(path);
			// The reader asked for another page since: a slower answer for this one must not replace it.
			if (request !== lastRequest.current) return;
			setPageData(newData);
			if (newData) document.title = getPageTitle(newData);
		} catch (err) {
			if (request !== lastRequest.current) return;
			console.error("failed to get page data", err);
			setError(err);
		}
	}, [path]);

	useEffect(() => {
		if (isFirstLoad.current) isFirstLoad.current = false;
		else void refresh();
	}, [refresh]);

	return { pageData, error, refresh };
};
