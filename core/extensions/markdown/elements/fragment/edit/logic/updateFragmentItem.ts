import type { FragmentItemProps } from "@ext/markdown/elements/fragment/edit/model/types";
import extractPreviewFromEditTree from "@ext/markdown/elementsUtils/extractPreviewFromEditTree";
import type { JSONContent } from "@tiptap/core";

export const updateFragmentItem = (
	fragment: FragmentItemProps,
	content: JSONContent,
	title: string,
): FragmentItemProps => {
	return {
		...fragment,
		title: title.trim(),
		description: extractPreviewFromEditTree(content),
		revision: (fragment.revision ?? 0) + 1,
	};
};

export const mergeFragmentItems = (
	current: FragmentItemProps[],
	incoming: FragmentItemProps[],
	selectedID?: string | null,
	requestRevisions: ReadonlyMap<string, number> = new Map(),
) => {
	const currentByID = new Map(current.map((fragment) => [fragment.id, fragment]));

	return incoming.map((fragment) => {
		const currentFragment = currentByID.get(fragment.id);
		const requestRevision = requestRevisions.get(fragment.id) ?? 0;
		const hasNewerLocalRevision = (currentFragment?.revision ?? 0) > requestRevision;

		return fragment.id === selectedID && hasNewerLocalRevision ? currentFragment : fragment;
	});
};
