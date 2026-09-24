import { fireEvent, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { CommentInput } from "./CommentInput";

// Floating chrome around the input: it reaches for catalog APIs that no test wires up, and it
// takes no part in the key handling under test.
jest.mock("@ext/markdown/elements/article/edit/helpers/InlineToolbar", () => ({
	InlineToolbar: () => null,
}));

jest.mock("@ext/markdown/elements/link/edit/components/LinkMenu/InlineLinkMenu", () => ({
	InlineLinkMenu: () => null,
}));

const renderInput = (onConfirm: jest.Mock) =>
	render(
		createElement(CommentInput, {
			autofocus: "end",
			content: [{ type: "paragraph", content: [{ type: "text", text: "hello comment" }] }],
			editable: true,
			onConfirm,
		}),
	);

const getEditor = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-testid="comment-editor"]');

describe("Comment input keyboard handling", () => {
	test("Mod+Enter confirms the comment once and leaves the document untouched", async () => {
		const onConfirm = jest.fn();
		const { container } = renderInput(onConfirm);

		await waitFor(() => expect(getEditor(container)).not.toBeNull());
		const editor = getEditor(container);
		editor.focus();
		const documentBefore = editor.innerHTML;

		fireEvent.keyDown(editor, { key: "Enter", code: "Enter", keyCode: 13, metaKey: true });

		expect(onConfirm).toHaveBeenCalledTimes(1);
		expect(editor.innerHTML).toBe(documentBefore);
	});
});
