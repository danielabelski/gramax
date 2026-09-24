import { useRouter } from "@core/Api/useRouter";
import type { ClientArticleProps, ClientCatalogProps } from "@core/SitePresenter/SitePresenter";
import type { ArticlePageData } from "@core/SitePresenter/types/ArticlePage";
import ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import type { TreeReadScope } from "@ext/git/core/GitCommands/model/GitCommandsModel";
import { useEffect, useRef, useState } from "react";

type UseGetArticleContextDataProps = {
	articlePath: string;
	catalogName: string;
	scope?: TreeReadScope;
};

const useGetArticleContextData = (props: UseGetArticleContextDataProps) => {
	const { articlePath, catalogName, scope } = props;
	const apiUrlCreatorService = ApiUrlCreatorService.value;

	const [articleProps, setArticleProps] = useState<ClientArticleProps>(null);
	const [catalogProps, setCatalogProps] = useState<ClientCatalogProps>(null);
	const [apiUrlCreator, setApiUrlCreator] = useState<ApiUrlCreator>(null);
	const basePath = useRouter().basePath;

	const isLoading = !articleProps || !catalogProps || !apiUrlCreator;

	// The scope object is rebuilt on every parent render, so depending on its identity refetched the
	// context constantly and let responses overtake each other. Depend on its value instead.
	const scopeKey = JSON.stringify(scope ?? null);
	const scopeRef = useRef(scope);
	scopeRef.current = scope;

	// biome-ignore lint/correctness/useExhaustiveDependencies: scope is read through the ref, by value
	useEffect(() => {
		if (!catalogName || !articlePath) return;

		// Consumers read articleProps/apiUrlCreator to decide where a save goes, so serving the
		// previous article's values while the new one loads would point a write at the wrong file.
		// Drop them first: isLoading turns true and ArticleContextWrapper renders its loader.
		setArticleProps(null);
		setCatalogProps(null);
		setApiUrlCreator(null);

		let cancelled = false;

		const fetchData = async () => {
			const url = apiUrlCreatorService.getScopedPageDataByArticleData(articlePath, catalogName, scopeRef.current);

			const res = await FetchService.fetch<ArticlePageData>(url, undefined, undefined, undefined, false);
			if (cancelled || !res.ok) return;

			const data = await res.json();
			// A slower response for a previous article must never land on the current one.
			if (cancelled || !data) return;

			setArticleProps(data?.articleProps);
			setCatalogProps(data?.catalogProps);
			setApiUrlCreator(new ApiUrlCreator(basePath, data.catalogProps?.name, data.articleProps?.ref?.path));
		};

		void fetchData();

		return () => {
			cancelled = true;
		};
	}, [articlePath, catalogName, scopeKey, basePath]);

	return { articleProps, catalogProps, apiUrlCreator, isLoading };
};

export default useGetArticleContextData;
