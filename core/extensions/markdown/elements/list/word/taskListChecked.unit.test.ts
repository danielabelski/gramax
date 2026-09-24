import { listItemWordLayout } from "@ext/markdown/elements/list/word/listItem";
import {
	NUMBERING_TEMPLATE_STYLE_LINKS,
	TASK_LIST_CHECKED_REFERENCE,
	TASK_LIST_REFERENCE,
} from "@ext/wordExport/lists/numberingReferences";
import { getWordDocumentStyles } from "@ext/wordExport/options/wordDocumentStyles";
import { TextRun } from "docx";

// Regression for gh#919: a checked task-list item must export a filled checkbox
// glyph in DOCX. The checkbox is driven by the paragraph's numbering reference,
// so a checked item has to carry a distinct reference ("taskListChecked") from an
// unchecked one ("taskList"). The reference is serialized on the Paragraph as
// "{<reference>-<level>}".
const numberingReference = (paragraph: unknown): string | null => {
	const serialized = JSON.stringify(paragraph, (_key, value) => (typeof value === "function" ? undefined : value));
	const match = serialized.match(/\{(taskList[A-Za-z]*)-\d+\}/);
	return match ? match[1] : null;
};

const renderTaskItem = async (checked: boolean) => {
	const state = { renderInline: async () => [new TextRun("Task")] };
	const tag = {
		name: "listItem",
		attributes: { isTaskItem: true, checked },
		children: [{ name: "p", children: [] }],
	};
	const result = await listItemWordLayout({
		state,
		tag,
		addOptions: { numbering: { reference: "taskList", level: 0 } },
		wordRenderContext: {},
	} as never);
	return result[0];
};

describe("taskList DOCX checkbox state (gh#919)", () => {
	it("keeps the empty-checkbox reference for an unchecked item", async () => {
		expect(numberingReference(await renderTaskItem(false))).toBe("taskList");
	});

	it("uses the checked-checkbox reference for a checked item", async () => {
		expect(numberingReference(await renderTaskItem(true))).toBe("taskListChecked");
	});

	// The item only names a reference — the reference itself has to be declared in the document
	// numbering, otherwise Packer leaves the literal "{taskListChecked-0}" in the docx.
	it("declares both checkbox references in the document numbering", async () => {
		const references = (await getWordDocumentStyles()).numbering.config.map((config) => config.reference);
		expect(references).toContain(TASK_LIST_REFERENCE);
		expect(references).toContain(TASK_LIST_CHECKED_REFERENCE);
	});

	// ...and the template export resolves placeholders through this map, so a reference missing
	// from it would produce a docx with a non-numeric w:numId that Word refuses to open.
	it("maps every declared reference to a template numbering style", async () => {
		const references = (await getWordDocumentStyles()).numbering.config.map((config) => config.reference);
		for (const reference of references) expect(NUMBERING_TEMPLATE_STYLE_LINKS[reference]).toBeTruthy();
	});
});
