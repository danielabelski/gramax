import generateUniqueID from "@core/utils/generateUniqueID";
import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import { useDeferApi } from "@core-ui/hooks/useApi";
import AgentSkillService from "@ext/agent/components/skills/AgentSkillService";
import { AGENT_SKILLS_PANEL_ID } from "@ext/agent/components/types/constants";
import {
	filterSkillItems,
	getSkillDescription,
	type AgentSkillListItem as SkillItem,
} from "@ext/agent/components/utils/skillListUtils";
import type { ProviderItemProps } from "@ext/articleProvider/models/types";
import t from "@ext/localization/locale/translate";
import NavigationEvents from "@ext/navigation/NavigationEvents";
import { EmptyState } from "@ui-kit/EmptyState";
import {
	FloatingIconButton,
	FloatingPanel,
	PanelEmptyState,
	PanelEmptyStateDescription,
	PanelEmptyStateIcon,
	PanelEmptyStateTitle,
	usePanelToggle,
} from "@ui-kit/FloatingPanel";
import { Icon } from "@ui-kit/Icon";
import { PopoverInput } from "@ui-kit/Input";
import { Loader } from "@ui-kit/Loader";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { ScrollShadowContainer } from "@ui-kit/ScrollShadowContainer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentSkillListItem } from "./AgentSkillListItem";

const LIST_OPTS = { consumeError: true } as const;

export const AgentSkillsPanel = () => {
	const apiUrlCreator = ApiUrlCreatorService.value;
	const { isOpen } = usePanelToggle(AGENT_SKILLS_PANEL_ID);
	const { selectedID, skills } = AgentSkillService.value;
	const [items, setItems] = useState<SkillItem[]>([]);
	const [search, setSearch] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const { call: callList } = useDeferApi<ProviderItemProps[]>({ opts: LIST_OPTS });
	const { call: callCreate } = useDeferApi<void>({ opts: LIST_OPTS });

	const fetchSkills = useCallback(async () => {
		if (!apiUrlCreator) return [];
		setIsLoading(true);
		try {
			const skills = (await callList({ url: apiUrlCreator.getArticleListInGramaxDir("agentSkill") })) ?? [];
			AgentSkillService.setItems(skills);
			const nextItems = await Promise.all(
				skills.map(async (skill) => {
					const response = await FetchService.fetch(
						apiUrlCreator.getFileContentInGramaxDir(skill.id, "agentSkill"),
					);
					const markdown = response.ok ? await response.text() : "";
					return { ...skill, description: getSkillDescription(markdown) };
				}),
			);
			setItems(nextItems);
			return nextItems;
		} finally {
			setIsLoading(false);
		}
	}, [callList]);

	useEffect(() => {
		if (isOpen) void fetchSkills();
	}, [fetchSkills, isOpen]);

	useEffect(() => {
		const closeItem = () => AgentSkillService.closeItem();
		const tokens = [
			NavigationEvents.on("item-click", closeItem),
			NavigationEvents.on("item-create", closeItem),
			NavigationEvents.on("item-delete", closeItem),
		];
		return () => tokens.forEach((token) => NavigationEvents.off(token));
	}, []);

	const addNewSkill = useCallback(async () => {
		if (!apiUrlCreator) return;
		const id = generateUniqueID();
		await callCreate({ url: apiUrlCreator.createFileInGramaxDir(id, "agentSkill") });
		const nextItems = await fetchSkills();
		const skill = nextItems.find((item) => item.id === id);
		if (skill) AgentSkillService.openItem(skill);
	}, [callCreate, fetchSkills]);

	const handleDelete = useCallback(
		(id: string) => {
			if (selectedID === id) AgentSkillService.closeItem();
			setItems((current) => {
				const next = current.filter((item) => item.id !== id);
				AgentSkillService.setItems(next);
				return next;
			});
		},
		[selectedID],
	);

	const handleMarkdownChange = useCallback(
		async (id: string) => {
			const nextItems = await fetchSkills();
			const skill = nextItems.find((item) => item.id === id);
			if (selectedID === id && skill) AgentSkillService.openItem(skill);
		},
		[fetchSkills, selectedID],
	);

	const visibleItems = useMemo(
		() =>
			filterSkillItems(
				items.map((item) => {
					const currentTitle = skills.get(item.id)?.title;
					return currentTitle !== undefined && currentTitle !== item.title
						? { ...item, title: currentTitle }
						: item;
				}),
				search,
			),
		[items, search, skills],
	);

	return (
		<FloatingPanel
			headerActions={
				<Tooltip>
					<TooltipTrigger asChild>
						<FloatingIconButton
							aria-label={t("agent.skills.new-skill")}
							data-testid="create-agent-skill"
							icon="plus"
							onClick={() => void addNewSkill()}
							size="md"
						/>
					</TooltipTrigger>
					<TooltipContent>{t("agent.skills.new-skill")}</TooltipContent>
				</Tooltip>
			}
			icon="scroll-text"
			id={AGENT_SKILLS_PANEL_ID}
			title={t("agent.skills.menu-name")}
		>
			<ComponentVariantProvider variant="glass">
				<div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
					<PopoverInput
						onChange={(value) => setSearch(value ?? "")}
						placeholder={t("agent.skills.search-placeholder")}
						startIcon={<Icon className="h-4 w-4 text-muted" icon="search" />}
						value={search}
					/>
					{isLoading && items.length === 0 ? (
						<Loader className="py-6" size="3xl" />
					) : items.length === 0 ? (
						<PanelEmptyState>
							<PanelEmptyStateIcon icon="wand-sparkles" />
							<PanelEmptyStateTitle>{t("agent.skills.empty-state.title")}</PanelEmptyStateTitle>
							<PanelEmptyStateDescription className="max-w-64">
								{t("agent.skills.empty-state.description")}
							</PanelEmptyStateDescription>
						</PanelEmptyState>
					) : visibleItems.length === 0 ? (
						<EmptyState>{t("agent.skills.no-skills")}</EmptyState>
					) : (
						<ScrollShadowContainer className="mt-2 flex min-h-0 flex-1 flex-col overflow-x-hidden">
							{visibleItems.map((item) => (
								<AgentSkillListItem
									isSelected={selectedID === item.id}
									item={item}
									key={item.id}
									onClick={(id) => {
										const skill = items.find((item) => item.id === id);
										if (skill) AgentSkillService.openItem(skill);
									}}
									onDelete={handleDelete}
									onMarkdownChange={handleMarkdownChange}
								/>
							))}
						</ScrollShadowContainer>
					)}
				</div>
			</ComponentVariantProvider>
		</FloatingPanel>
	);
};
