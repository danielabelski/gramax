import docx from "@dynamicImports/docx";
import { WordFontStyles } from "@ext/wordExport/options/wordExportSettings";
import { createContent } from "@ext/wordExport/TextWordGenerator";
import { escapeLinkForPatcher } from "@ext/wordExport/utils/escapeLinkForPatcher";
import type { WordInlineChild } from "../../../../wordExport/options/WordTypes";

export const termWordLayout: WordInlineChild = async ({ tag, addOptions }) => {
	const children = [await createContent(tag.attributes.title, { ...addOptions, style: WordFontStyles.term })];
	if (!tag.attributes.url) return children;

	const { ExternalHyperlink } = await docx();
	return [
		new ExternalHyperlink({
			children,
			link: escapeLinkForPatcher(tag.attributes.url),
		}),
	];
};
