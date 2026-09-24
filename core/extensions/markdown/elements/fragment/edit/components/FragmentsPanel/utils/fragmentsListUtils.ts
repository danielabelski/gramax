import type { RenderableTreeNode, RenderableTreeNodes } from "@ext/markdown/core/render/logic/Markdoc";
import type { JSONContent } from "@tiptap/core";
import type { FragmentListItem } from "../types/constants";

const normalizeSearchValue = (value?: string | null) => (value ?? "").toLowerCase();

export const filterFragments = (fragments: FragmentListItem[], query?: string | null) => {
	const normalizedQuery = normalizeSearchValue(query);

	return fragments.filter((fragment) => {
		const title = normalizeSearchValue(fragment.title);
		const description = normalizeSearchValue(fragment.description);

		return title.includes(normalizedQuery) || description.includes(normalizedQuery);
	});
};

type FragmentDescriptionNode = RenderableTreeNode | JSONContent | FragmentDescriptionNode[];

const collectRenderText = (node: FragmentDescriptionNode, parts: string[]) => {
	if (Array.isArray(node)) {
		node.forEach((child) => collectRenderText(child, parts));
		return;
	}
	if (typeof node === "string") {
		parts.push(node);
		return;
	}
	if (!node) return;

	if ("text" in node && node.text) parts.push(node.text);
	const children = "children" in node ? node.children : node.content;
	children?.forEach((child) => collectRenderText(child, parts));
};

export const getFragmentDescription = (content: RenderableTreeNodes | JSONContent | JSONContent[]) => {
	const parts: string[] = [];
	collectRenderText(content, parts);
	return parts.join(" ").replace(/\s+/g, " ").trim();
};
