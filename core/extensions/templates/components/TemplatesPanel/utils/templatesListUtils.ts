import type { RenderableTreeNode, RenderableTreeNodes } from "@ext/markdown/core/render/logic/Markdoc";
import type { JSONContent } from "@tiptap/core";
import type { TemplateSearchItem } from "../types/constants";

const normalizeSearchValue = (value?: string | null) => (value ?? "").toLowerCase();

export const filterTemplates = <T extends TemplateSearchItem>(templates: T[], query?: string | null): T[] => {
	const normalizedQuery = normalizeSearchValue(query);

	if (!normalizedQuery) return templates;

	return templates.filter((template) => {
		const title = normalizeSearchValue(template.title);
		const description = normalizeSearchValue(template.description);

		return title.includes(normalizedQuery) || description.includes(normalizedQuery);
	});
};

type TemplateDescriptionNode = RenderableTreeNode | JSONContent | TemplateDescriptionNode[];

const collectText = (node: TemplateDescriptionNode, parts: string[]) => {
	if (Array.isArray(node)) {
		node.forEach((child) => collectText(child, parts));
		return;
	}
	if (typeof node === "string") {
		parts.push(node);
		return;
	}
	if (!node) return;

	if ("text" in node && typeof node.text === "string") parts.push(node.text);
	if ("children" in node && Array.isArray(node.children)) collectText(node.children, parts);
	if ("content" in node && Array.isArray(node.content)) collectText(node.content, parts);
};

export const getTemplateDescription = (content: RenderableTreeNodes | JSONContent | JSONContent[] | null): string => {
	const parts: string[] = [];
	collectText(content, parts);

	return parts.join(" ").replace(/\s+/g, " ").trim();
};
