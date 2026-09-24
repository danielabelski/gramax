import docx from "@dynamicImports/docx";
import { wordFontSizes, wordFontTypes } from "@ext/wordExport/options/wordExportSettings";
import type { File, LevelFormat } from "docx";
import { getMmToTw, LIST_HANGING_MM, LIST_LEFT_INDENT_MM } from "../lists/consts";
import { TASK_LIST_CHECKED_REFERENCE, TASK_LIST_REFERENCE } from "../lists/numberingReferences";

type IPropertiesOptions = ConstructorParameters<typeof File>[0];

const levelText = {
	0: "\u00B7",
	1: "\u25CB",
	2: "\u00A7",
};

const levelFont = {
	0: "Symbol",
	1: "Times New Roman",
	2: "Wingdings",
};

type LevelFormatMap = {
	0: typeof LevelFormat.DECIMAL;
	1: typeof LevelFormat.LOWER_LETTER;
	2: typeof LevelFormat.LOWER_ROMAN;
};

let levelFormat: LevelFormatMap;

const getNumberFormat = async (level: number) => {
	if (!levelFormat) {
		const { LevelFormat } = await docx();
		levelFormat = {
			0: LevelFormat.DECIMAL,
			1: LevelFormat.LOWER_LETTER,
			2: LevelFormat.LOWER_ROMAN,
		};
	}
	return {
		format: levelFormat[level % 3],
		text: `%${level + 1}.`,
	};
};

export const getBulletSymbol = (level: number) => ({
	text: levelText[level % 3],
	font: levelFont[level % 3],
});

export const leftIndentMillimeters = 7;

const EMPTY_CHECKBOX = "\u2610";
const CHECKED_CHECKBOX = "\u2611";

let wordDocumentStyles: Omit<IPropertiesOptions, "sections">;

export const getWordDocumentStyles = async (): Promise<Omit<IPropertiesOptions, "sections">> => {
	if (!wordDocumentStyles) {
		const { AlignmentType, LevelFormat } = await docx();
		const mmToTw = await getMmToTw();

		// gh#919: the DOCX checkbox is drawn by the numbering glyph, not by the item text, so a
		// checked and an unchecked task item differ only by the numbering reference they point at.
		const checkboxNumbering = (reference: string, glyph: string) => ({
			reference,
			levels: Array.from({ length: 9 }).map((_, level) => ({
				level,
				format: LevelFormat.BULLET,
				text: glyph,
				alignment: AlignmentType.START,
				style: {
					run: {
						font: wordFontTypes.numbering,
						size: wordFontSizes.list,
					},
					paragraph: {
						indent: {
							left: mmToTw(LIST_LEFT_INDENT_MM(level)),
							hanging: mmToTw(LIST_HANGING_MM),
						},
					},
				},
			})),
		});

		wordDocumentStyles = {
			numbering: {
				config: [
					{
						reference: "orderedList",
						levels: await Array.from({ length: 9 }).mapAsync(async (_, level) => ({
							level,
							...(await getNumberFormat(level)),
							alignment: AlignmentType.START,
							style: {
								run: {
									font: wordFontTypes.numbering,
									size: wordFontSizes.list,
								},
								paragraph: {
									indent: {
										left: mmToTw(LIST_LEFT_INDENT_MM(level)),
										hanging: mmToTw(LIST_HANGING_MM),
									},
								},
							},
						})),
					},
					{
						reference: "bulletList",
						levels: Array.from({ length: 9 }).map((_, level) => {
							const { text, font } = getBulletSymbol(level);
							return {
								level,
								format: LevelFormat.BULLET,
								text,
								alignment: AlignmentType.START,
								style: {
									run: {
										font,
										size: wordFontSizes.list,
									},
									paragraph: {
										indent: {
											left: mmToTw(LIST_LEFT_INDENT_MM(level)),
											hanging: mmToTw(LIST_HANGING_MM),
										},
									},
								},
							};
						}),
					},
					checkboxNumbering(TASK_LIST_REFERENCE, EMPTY_CHECKBOX),
					checkboxNumbering(TASK_LIST_CHECKED_REFERENCE, CHECKED_CHECKBOX),
				],
			},
		};
	}
	return wordDocumentStyles;
};
