import { cn } from "@core-ui/utils/cn";
import t, { type TranslationKey } from "@ext/localization/locale/translate";
import { SearchContentChat } from "@ext/serach/components/chat/SearchContentChat";
import type { SearchStatus } from "@ext/serach/components/model/searchResponse";
import { SearchContentResults } from "@ext/serach/components/results/SearchContentResults";
import { SearchContentHelp } from "@ext/serach/components/SearchContentHelp";
import { useSearch } from "@ext/serach/components/SearchContext";
import { FeatureIcon } from "@ui-kit/Icon";
import { ScrollShadowContainer } from "@ui-kit/ScrollShadowContainer";
import { type ReactNode, useRef } from "react";

export const SearchContent = () => {
	const state = useSearch();
	const containerRef = useRef<HTMLDivElement>(null);

	return (
		<ScrollShadowContainer className="p-2.5" ref={containerRef}>
			{state.status === "results" ? (
				state.aiEnabled === true ? (
					<SearchContentChat nodes={state.data} onLinkOpen={state.onLinkOpen} />
				) : (
					<SearchContentResults
						containerRef={containerRef}
						currentRefPath={state.currentArticleRefPath}
						focus={state.focus}
						onLinkOpen={state.onLinkOpen}
						rows={state.data}
						showCatalog={state.scope.showCatalogBreadcrumb}
					/>
				)
			) : (
				<SearchPlaceholder aiEnabled={state.aiEnabled} status={state.status} />
			)}
		</ScrollShadowContainer>
	);
};

interface SearchPlaceholderProps {
	status: Exclude<SearchStatus, "results">;
	aiEnabled: boolean;
}

const statusPlaceholders: Record<Exclude<SearchStatus, "results" | "help">, { icon: string; text: TranslationKey }> = {
	loading: { icon: "loader", text: "loading" },
	error: { icon: "circle-alert", text: "app.error.command-failed.title" },
	empty: { icon: "search-x", text: "search.articles-not-found" },
};

const SearchPlaceholder = (props: SearchPlaceholderProps) => {
	const { status, aiEnabled } = props;
	if (status === "help") return <SearchHelpPlaceholder aiEnabled={aiEnabled} />;

	const { icon, text } = statusPlaceholders[status];

	return (
		<SearchPlaceholderLayout centered icon={icon}>
			{t(text)}
		</SearchPlaceholderLayout>
	);
};

const SearchHelpPlaceholder = (props: { aiEnabled: boolean }) => {
	const { aiEnabled } = props;

	return (
		<SearchPlaceholderLayout icon="search">
			<>
				<span className="font-semibold mb-3">
					{aiEnabled ? t("search.help.ai.title") : t("search.help.title")}
				</span>
				{aiEnabled ? t("search.help.ai.description") : <SearchContentHelp />}
			</>
		</SearchPlaceholderLayout>
	);
};

interface SearchPlaceholderLayoutProps {
	icon: string;
	centered?: boolean;
	children: ReactNode;
}

const SearchPlaceholderLayout = (props: SearchPlaceholderLayoutProps) => {
	const { icon, centered, children } = props;

	return (
		<div className={cn("min-h-[16rem] flex justify-center", centered && "items-center")}>
			<div className="flex flex-col items-center text-muted font-normal text-base pt-8 pb-14 text-center">
				<FeatureIcon className="rounded-full ring-0 bg-alpha-10 mb-5" icon={icon} size="2xl" />
				{children}
			</div>
		</div>
	);
};
