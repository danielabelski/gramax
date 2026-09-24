import PageDataContext from "@core-ui/ContextServices/PageDataContext";
import CommentView from "@ext/markdown/elements/comment/edit/components/View/CommentView";
import { render } from "@testing-library/react";
import { createElement } from "react";

interface MockTooltipProps {
	appendTo: () => HTMLElement;
	popperOptions: {
		modifiers: {
			name: string;
			options: { boundary: HTMLElement | string; padding?: Record<string, number> };
		}[];
	};
}

let mockTooltipProps: MockTooltipProps;

jest.mock("@components/Atoms/Tooltip", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest requires this ESM marker.
	__esModule: true,
	default: (props: MockTooltipProps) => {
		mockTooltipProps = props;
		return null;
	},
}));

describe("CommentView", () => {
	it("keeps the comment and its shadow inside the article content", () => {
		const articleBoundary = document.createElement("div");
		articleBoundary.className = "article-content-wrapper";
		const editorContainer = document.createElement("div");
		const editorDom = document.createElement("div");
		editorContainer.append(editorDom);
		articleBoundary.append(editorContainer);
		document.body.append(articleBoundary);

		const editor = {
			isEditable: true,
			extensionManager: { extensions: [] },
			view: { dom: editorDom },
			on: jest.fn(),
			off: jest.fn(),
		};

		render(
			createElement(PageDataContext.Provider, {
				value: { user: { info: { mail: "user@example.com", name: "User" } } } as never,
				// biome-ignore lint/correctness/noChildrenProp: createElement requires the provider's children field.
				children: createElement(CommentView, {
					commentId: "",
					editor: editor as never,
					loadComment: jest.fn(),
					saveComment: jest.fn(),
					deleteComment: jest.fn(),
				}),
			}),
		);

		expect(mockTooltipProps.appendTo()).toBe(editorContainer);
		expect(mockTooltipProps.popperOptions.modifiers).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "preventOverflow",
					options: {
						boundary: articleBoundary,
						padding: { bottom: 56, left: 48, right: 48, top: 48 },
					},
				}),
			]),
		);

		articleBoundary.remove();
	});
});
