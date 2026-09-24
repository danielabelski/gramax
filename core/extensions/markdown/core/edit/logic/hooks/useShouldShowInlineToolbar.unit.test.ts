import { shouldShowInlineToolbar } from "@ext/markdown/core/edit/logic/hooks/useShouldShowInlineToolbar";
import type { Editor } from "@tiptap/core";

jest.mock("prosemirror-tables", () => ({
	CellSelection: class MockCellSelection {},
}));

type MockParent = { type: { name: string } };

const makeEditor = (parentName: string, { isEditable = true } = {}): Editor => {
	const paragraph: MockParent = { type: { name: "paragraph" } };
	const title: MockParent = { type: { name: "paragraph" } };
	const parent = parentName === "paragraph" ? paragraph : { type: { name: parentName } };
	return {
		isEditable,
		state: {
			selection: {
				from: 3,
				to: 8,
				empty: false,
				// biome-ignore lint/style/useNamingConvention: prosemirror ResolvedPos accessor name
				$from: { parent },
			},
			doc: {
				firstChild: title,
				textBetween: () => "selected text",
			},
		},
	} as unknown as Editor;
};

describe("shouldShowInlineToolbar", () => {
	test("shows for a non-empty selection in a normal paragraph", () => {
		expect(shouldShowInlineToolbar(makeEditor("paragraph"), false)).toBe(true);
	});

	test("hides when the selection sits inside a code block", () => {
		expect(shouldShowInlineToolbar(makeEditor("code_block"), false)).toBe(false);
	});

	test("hides on mobile regardless of the selection", () => {
		expect(shouldShowInlineToolbar(makeEditor("paragraph"), true)).toBe(false);
	});

	test("hides when the editor is not editable", () => {
		expect(shouldShowInlineToolbar(makeEditor("paragraph", { isEditable: false }), false)).toBe(false);
	});
});
