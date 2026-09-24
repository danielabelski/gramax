import docx from "@dynamicImports/docx";
import t from "@ext/localization/locale/translate";
import { WordFontStyles } from "@ext/wordExport/options/wordExportSettings";
import { escapeLinkForPatcher } from "@ext/wordExport/utils/escapeLinkForPatcher";
import type { WordBlockChild } from "../../../../wordExport/options/WordTypes";

export const videoWordLayout: WordBlockChild = async ({ tag }) => {
	const { ExternalHyperlink, Paragraph, TextRun } = await docx();
	const videoString = t("word.video");
	const title = tag.attributes?.title;
	const path = tag.attributes?.path;

	const children = [
		new TextRun({
			text: title ? `${videoString}: ` : `${videoString} `,
			style: path ? WordFontStyles.link : undefined,
		}),
		new TextRun({ text: title }),
	];

	return await Promise.resolve([
		new Paragraph({
			// A video block without a url has nothing to link to: an ExternalHyperlink with an
			// empty link writes a relationship with Target="", which Word reports as damage.
			children: path ? [new ExternalHyperlink({ children, link: escapeLinkForPatcher(path) })] : children,
			style: WordFontStyles.videoTitle,
		}),
	]);
};
