/** biome-ignore-all lint/correctness/useExhaustiveDependencies: apiUrlCreator changes on workspace switch */
import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import type { ProviderItemProps } from "@ext/articleProvider/models/types";
import t from "@ext/localization/locale/translate";
import TemplateService from "@ext/templates/components/TemplateService";
import { mergeTemplateItems } from "@ext/templates/logic/updateTemplateItem";
import type { JSONContent } from "@tiptap/core";
import { EmptyState } from "@ui-kit/EmptyState";
import {
	FloatingIconButton,
	FloatingPanel,
	PanelEmptyState,
	PanelEmptyStateDescription,
	PanelEmptyStateIcon,
	PanelEmptyStateTitle,
	useFloatingPanelStore,
} from "@ui-kit/FloatingPanel";
import { Icon } from "@ui-kit/Icon";
import { PopoverInput } from "@ui-kit/Input";
import { Loader } from "@ui-kit/Loader";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { ScrollShadowContainer } from "@ui-kit/ScrollShadowContainer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TemplatesListItem } from "./TemplatesListItem";
import { TEMPLATES_PANEL_ID, type TemplateItemProps } from "./types/constants";
import { filterTemplates, getTemplateDescription } from "./utils/templatesListUtils";

export const TemplatesPanel = () => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const { templates, selectedID } = TemplateService.value;
	const templatesRef = useRef(templates);
	const selectedIDRef = useRef(selectedID);
	templatesRef.current = templates;
	selectedIDRef.current = selectedID;
	const [query, setQuery] = useState("");
	const [isLoading, setIsLoading] = useState(true);
	const [hasLoadedSuccessfully, setHasLoadedSuccessfully] = useState(() => templates.size > 0);
	const isOpen = useFloatingPanelStore((state) => state.panels[TEMPLATES_PANEL_ID]?.isOpen ?? false);

	const refresh = useCallback(async () => {
		setIsLoading(true);
		const requestRevisions = new Map(
			Array.from(templatesRef.current.values()).map((template) => [template.id, template.revision ?? 0]),
		);

		try {
			const response = await FetchService.fetch<ProviderItemProps[]>(
				apiUrlCreator.getArticleListInGramaxDir("template"),
			);
			if (!response.ok) {
				setHasLoadedSuccessfully(templatesRef.current.size > 0);
				return mergeTemplateItems(
					Array.from(templatesRef.current.values()),
					null,
					selectedIDRef.current,
					requestRevisions,
				);
			}

			const metadata = await response.json();
			const enrichedTemplates = await Promise.all(
				metadata.map(async (template): Promise<TemplateItemProps> => {
					try {
						const contentResponse = await FetchService.fetch<JSONContent>(
							apiUrlCreator.getEditTreeInGramaxDir(template.id, "template"),
						);
						if (!contentResponse.ok) {
							return { ...template, description: templatesRef.current.get(template.id)?.description };
						}

						const content = await contentResponse.json();
						return { ...template, description: getTemplateDescription(content) };
					} catch {
						return { ...template, description: templatesRef.current.get(template.id)?.description };
					}
				}),
			);

			const mergedTemplates = mergeTemplateItems(
				Array.from(templatesRef.current.values()),
				enrichedTemplates,
				selectedIDRef.current,
				requestRevisions,
			);
			templatesRef.current = new Map(mergedTemplates.map((template) => [template.id, template]));
			TemplateService.setItems(mergedTemplates);
			setHasLoadedSuccessfully(true);
			return mergedTemplates;
		} catch {
			setHasLoadedSuccessfully(templatesRef.current.size > 0);
			return mergeTemplateItems(
				Array.from(templatesRef.current.values()),
				null,
				selectedIDRef.current,
				requestRevisions,
			);
		} finally {
			setIsLoading(false);
		}
	}, [apiUrlCreator]);

	useEffect(() => {
		if (!isOpen) return;
		void refresh();
	}, [isOpen, refresh]);

	const createTemplate = useCallback(async () => {
		const createdTemplate = await TemplateService.addNewTemplate(apiUrlCreator);
		if (!createdTemplate) return;

		const refreshedTemplates = await refresh();
		const templateToOpen =
			refreshedTemplates.find((template) => template.id === createdTemplate.id) ?? createdTemplate;
		TemplateService.openItem(templateToOpen);
	}, [apiUrlCreator, refresh]);

	const filteredTemplates = useMemo(() => filterTemplates(Array.from(templates.values()), query), [templates, query]);

	return (
		<FloatingPanel
			headerActions={
				<Tooltip>
					<TooltipTrigger asChild>
						<FloatingIconButton
							data-testid="create-template"
							icon="plus"
							onClick={() => void createTemplate()}
							size="md"
						/>
					</TooltipTrigger>
					<TooltipContent>{t("templates-panel-create")}</TooltipContent>
				</Tooltip>
			}
			icon="layout-template"
			id={TEMPLATES_PANEL_ID}
			title={t("templates-panel-title")}
		>
			<ComponentVariantProvider variant="glass">
				<div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
					<PopoverInput
						onChange={(value) => setQuery(value ?? "")}
						placeholder={t("templates-panel-search")}
						startIcon={<Icon className="h-4 w-4 text-muted" icon="search" />}
						value={query}
					/>
					{isLoading || !hasLoadedSuccessfully ? (
						<Loader aria-label={t("templates-panel-loading")} className="py-6" size="3xl" />
					) : templates.size === 0 ? (
						<PanelEmptyState>
							<PanelEmptyStateIcon icon="layout-template" />
							<PanelEmptyStateTitle>{t("template.empty-state.title")}</PanelEmptyStateTitle>
							<PanelEmptyStateDescription className="max-w-64">
								{t("template.empty-state.description")}
							</PanelEmptyStateDescription>
						</PanelEmptyState>
					) : filteredTemplates.length ? (
						<ScrollShadowContainer className="mt-2 flex min-h-0 flex-1 flex-col overflow-x-hidden">
							{filteredTemplates.map((template) => (
								<TemplatesListItem
									isSelected={template.id === selectedID}
									key={template.id}
									onOpen={() => TemplateService.openItem(template)}
									onRefresh={refresh}
									template={template}
								/>
							))}
						</ScrollShadowContainer>
					) : (
						<EmptyState>{t("templates-panel-empty")}</EmptyState>
					)}
				</div>
			</ComponentVariantProvider>
		</FloatingPanel>
	);
};
