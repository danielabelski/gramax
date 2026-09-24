/** biome-ignore-all lint/correctness/useExhaustiveDependencies: apiUrlCreator changes on workspace switch */
import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import type { ProviderItemProps } from "@ext/articleProvider/models/types";
import t from "@ext/localization/locale/translate";
import FragmentService from "@ext/markdown/elements/fragment/edit/components/Tab/FragmentService";
import { mergeFragmentItems } from "@ext/markdown/elements/fragment/edit/logic/updateFragmentItem";
import type { FragmentItemProps, FragmentRenderData } from "@ext/markdown/elements/fragment/edit/model/types";
import { EmptyState } from "@ui-kit/EmptyState";
import {
	FloatingPanel,
	PanelEmptyState,
	PanelEmptyStateDescription,
	PanelEmptyStateIcon,
	PanelEmptyStateTitle,
	useFloatingPanelStore,
} from "@ui-kit/FloatingPanel";
import { FloatingIconButton } from "@ui-kit/FloatingPanel/components/FloatingIconButton";
import { Icon } from "@ui-kit/Icon";
import { PopoverInput } from "@ui-kit/Input";
import { Loader } from "@ui-kit/Loader";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { ScrollShadowContainer } from "@ui-kit/ScrollShadowContainer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FragmentsListItem } from "./FragmentsListItem";
import { FRAGMENTS_PANEL_ID } from "./types/constants";
import { filterFragments, getFragmentDescription } from "./utils/fragmentsListUtils";

export const FragmentsPanel = () => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const { fragments, selectedID } = FragmentService.value;
	const fragmentsRef = useRef(fragments);
	const selectedIDRef = useRef(selectedID);
	fragmentsRef.current = fragments;
	selectedIDRef.current = selectedID;
	const [query, setQuery] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const isOpen = useFloatingPanelStore((state) => state.panels[FRAGMENTS_PANEL_ID]?.isOpen ?? false);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		const requestRevisions = new Map(
			Array.from(fragmentsRef.current.values()).map((fragment) => [fragment.id, fragment.revision ?? 0]),
		);
		const response = await FetchService.fetch<ProviderItemProps[]>(
			apiUrlCreator.getArticleListInGramaxDir("fragment"),
		);
		if (!response.ok) {
			setIsLoading(false);
			return [];
		}
		const fragmentItems = await response.json();
		const nextFragments = await Promise.all(
			fragmentItems.map(async (fragment): Promise<FragmentItemProps> => {
				const renderResponse = await FetchService.fetch<FragmentRenderData>(
					apiUrlCreator.getFragmentRenderData(fragment.id),
				);
				if (!renderResponse.ok) return fragment;

				const renderData = await renderResponse.json();
				return { ...fragment, description: getFragmentDescription(renderData.content) };
			}),
		);

		const mergedFragments = mergeFragmentItems(
			Array.from(fragmentsRef.current.values()),
			nextFragments,
			selectedIDRef.current,
			requestRevisions,
		);
		fragmentsRef.current = new Map(mergedFragments.map((fragment) => [fragment.id, fragment]));
		FragmentService.setItems(mergedFragments);
		setIsLoading(false);
		return mergedFragments;
	}, [apiUrlCreator]);

	useEffect(() => {
		if (!isOpen) return;
		void refresh();
	}, [isOpen, refresh]);

	const createFragment = useCallback(async () => {
		const createdFragment = await FragmentService.addNewFragment(apiUrlCreator);
		if (!createdFragment) return;

		const nextFragments = await refresh();
		const fragmentToOpen = nextFragments.find((fragment) => fragment.id === createdFragment.id);
		if (fragmentToOpen) FragmentService.openItem({ id: fragmentToOpen.id, title: fragmentToOpen.title ?? "" });
	}, [apiUrlCreator, refresh]);

	const filteredFragments = useMemo(() => filterFragments(Array.from(fragments.values()), query), [fragments, query]);

	return (
		<FloatingPanel
			headerActions={
				<Tooltip>
					<TooltipTrigger asChild>
						<FloatingIconButton
							data-testid="create-fragment"
							icon="plus"
							onClick={() => void createFragment()}
							size="md"
						/>
					</TooltipTrigger>
					<TooltipContent>{t("fragments-panel-create")}</TooltipContent>
				</Tooltip>
			}
			icon="square-dashed-bottom"
			id={FRAGMENTS_PANEL_ID}
			title={t("fragments-panel-title")}
		>
			<ComponentVariantProvider variant="glass">
				<div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
					<PopoverInput
						onChange={(value) => setQuery(value ?? "")}
						placeholder={t("fragments-panel-search")}
						startIcon={<Icon className="h-4 w-4 text-muted" icon="search" />}
						value={query}
					/>
					{isLoading ? (
						<Loader aria-label={t("fragments-panel-loading")} className="py-6" size="3xl" />
					) : fragments.size === 0 ? (
						<PanelEmptyState data-testid="fragments-empty-state">
							<PanelEmptyStateIcon icon="puzzle" />
							<PanelEmptyStateTitle>{t("fragments-panel-empty-state.title")}</PanelEmptyStateTitle>
							<PanelEmptyStateDescription className="max-w-64">
								{t("fragments-panel-empty-state.description")}
							</PanelEmptyStateDescription>
						</PanelEmptyState>
					) : filteredFragments.length ? (
						<ScrollShadowContainer className="mt-2 flex min-h-0 flex-1 flex-col overflow-x-hidden">
							{filteredFragments.map((fragment) => (
								<FragmentsListItem
									fragment={fragment}
									isSelected={fragment.id === selectedID}
									key={fragment.id}
									onOpen={() =>
										FragmentService.openItem({ id: fragment.id, title: fragment.title ?? "" })
									}
									onRefresh={refresh}
								/>
							))}
						</ScrollShadowContainer>
					) : (
						<EmptyState data-testid="fragments-empty-state">{t("fragments-panel-empty")}</EmptyState>
					)}
				</div>
			</ComponentVariantProvider>
		</FloatingPanel>
	);
};
