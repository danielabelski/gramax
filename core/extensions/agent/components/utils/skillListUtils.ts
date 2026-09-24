import type { ProviderItemProps } from "@ext/articleProvider/models/types";

export type AgentSkillListItem = ProviderItemProps & {
	description: string;
};

export const getSkillDescription = (markdown: string): string => {
	const [firstParagraph = ""] = markdown.replace(/\r\n/g, "\n").split(/\n\s*\n/);
	return firstParagraph.replace(/\s*\n\s*/g, " ").trim();
};

export const filterSkillItems = (items: AgentSkillListItem[], search: string): AgentSkillListItem[] => {
	const query = search.trim().toLocaleLowerCase();
	if (!query) return items;
	return items.filter((item) => `${item.title}\n${item.description}`.toLocaleLowerCase().includes(query));
};
