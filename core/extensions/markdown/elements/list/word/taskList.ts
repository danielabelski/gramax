import { TASK_LIST_REFERENCE } from "@ext/wordExport/lists/numberingReferences";
import type { WordBlockChild } from "../../../../wordExport/options/WordTypes";
import { wordNestedListMaxLevel } from "./WordListLevel";
import { WordListRenderer } from "./WordListRenderer";

export const taskListWordLayout: WordBlockChild = async ({ state, tag, addOptions }) => {
	const reference = TASK_LIST_REFERENCE;

	const attrs = "attributes" in tag ? tag.attributes : tag.attrs;
	const level = Math.min(attrs.depth ?? 0, wordNestedListMaxLevel);
	const numbering = { reference, level };

	return await WordListRenderer.renderList(state, tag, { numbering, ...addOptions });
};
