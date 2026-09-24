import type { CatalogView } from "@ext/catalog/views/models/CatalogViews";
import type { RenderableTreeNodes } from "@ext/markdown/core/render/logic/Markdoc";
import type TabAttrs from "@ext/markdown/elements/tabs/model/TabAttrs";
import type { JSONContent } from "@tiptap/core";
import getVisibleTabs from "./getVisibleTabs";

type ContentTree = RenderableTreeNodes | JSONContent;
type TagLike = { name: string; attributes?: Record<string, unknown>; children?: ContentTree[] };

const isTagLike = (content: ContentTree): content is TagLike =>
	!!content && typeof content === "object" && "name" in content;

const isJsonContent = (content: ContentTree): content is JSONContent =>
	!!content && typeof content === "object" && "type" in content;

const filterTabsByView = (content: ContentTree, view?: CatalogView): ContentTree => {
	if (!view || !content) return content;
	if (Array.isArray(content)) return content.flatMap((node) => filterTabsByView(node, view));

	if (isTagLike(content)) {
		const children = (content.children ?? []).flatMap((node) => filterTabsByView(node, view));
		if (content.name !== "tabs") return { ...content, children };
		const tabs = children.filter((child) => isTagLike(child) && child.name === "tab") as TagLike[];
		const visible = getVisibleTabs(
			tabs.map((tab) => (tab.attributes ?? {}) as TabAttrs),
			view,
		);
		let tabIndex = 0;
		let visibleIndex = 0;
		const filtered = children.flatMap((child) => {
			if (!isTagLike(child) || child.name !== "tab") return [child];
			if (!visible.indexes.includes(tabIndex++)) return [];
			return [{ ...child, attributes: { ...child.attributes, idx: visibleIndex++ } }];
		});
		if (filtered.length <= 1) return filtered;
		return { ...content, attributes: { ...content.attributes, childAttrs: visible.tabs }, children: filtered };
	}

	if (isJsonContent(content)) {
		const children = (content.content ?? []).map((node) => filterTabsByView(node, view) as JSONContent);
		if (content.type !== "tabs") return { ...content, content: children };
		const tabs = children.filter((child) => child.type === "tab");
		const visible = getVisibleTabs(
			tabs.map((tab) => (tab.attrs ?? {}) as TabAttrs),
			view,
		);
		let tabIndex = 0;
		let visibleIndex = 0;
		const filtered = children.flatMap((child) => {
			if (child.type !== "tab") return [child];
			if (!visible.indexes.includes(tabIndex++)) return [];
			return [{ ...child, attrs: { ...child.attrs, idx: visibleIndex++ } }];
		});
		if (filtered.length <= 1) return filtered[0] ?? null;
		return { ...content, attrs: { ...content.attrs, childAttrs: visible.tabs }, content: filtered };
	}

	return content;
};

export default filterTabsByView;
