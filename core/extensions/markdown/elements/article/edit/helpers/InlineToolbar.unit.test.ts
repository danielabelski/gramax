import {
	ArticleDimensionsContext,
	createArticleDimensions,
} from "@components/Layouts/CatalogLayout/ArticleLayout/useArticleDimensions";
import { InlineToolbar } from "@ext/markdown/elements/article/edit/helpers/InlineToolbar";
import { act, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

let mockShouldShow: (props: { editor: unknown }) => boolean;
interface MockTippyOptions {
	appendTo: () => HTMLElement | null;
	onShow: (instance: unknown) => void;
	onHide: () => void;
	onHidden: () => void;
	zIndex: number;
	popperOptions?: {
		modifiers: {
			name: string;
			options: { boundary: HTMLElement; padding: Record<string, number> };
		}[];
	};
}

let mockTippyOptions: MockTippyOptions;

jest.mock("@core-ui/hooks/useMediaQuery", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest requires this ESM marker.
	__esModule: true,
	default: () => false,
}));
jest.mock("@ext/markdown/elements/article/edit/helpers/InlineEditPanel", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest requires this ESM marker.
	__esModule: true,
	default: ({ isInTable, isCellSelection }: { isInTable: boolean; isCellSelection: boolean }) =>
		require("react").createElement("div", {
			"data-cell-selection": isCellSelection,
			"data-in-table": isInTable,
			"data-testid": "inline-edit-panel",
		}),
}));
jest.mock("prosemirror-tables", () => ({
	CellSelection: class MockCellSelection {},
	isInTable: (state: { inTable: boolean }) => state.inTable,
}));
jest.mock("@ext/markdown/elements/customBubbleMenu/edit/components/CustomBubbleMenu", () => ({
	CustomBubbleMenu: ({
		children,
		shouldShow,
		tippyOptions,
	}: {
		children: ReactNode;
		shouldShow: typeof mockShouldShow;
		tippyOptions: MockTippyOptions | (() => MockTippyOptions);
	}) => {
		mockShouldShow = shouldShow;
		mockTippyOptions = typeof tippyOptions === "function" ? tippyOptions() : tippyOptions;
		return require("react").createElement("div", null, children);
	},
}));

describe("InlineToolbar", () => {
	test("mounts the edit panel only while the bubble menu is visible", () => {
		const editor = {
			commands: { focus: jest.fn() },
			on: jest.fn(),
			off: jest.fn(),
			state: { inTable: false, selection: {} },
			view: { dom: document.createElement("div") },
		};
		render(
			createElement(InlineToolbar, {
				editor: editor as never,
				shouldShow: () => true,
			}),
		);

		expect(screen.queryByTestId("inline-edit-panel")).toBeNull();

		act(() => mockShouldShow({ editor }));

		expect(screen.queryByTestId("inline-edit-panel")).not.toBeNull();

		act(() => mockTippyOptions.onHide());

		expect(screen.queryByTestId("inline-edit-panel")).not.toBeNull();

		act(() => mockTippyOptions.onHidden());

		expect(screen.queryByTestId("inline-edit-panel")).toBeNull();
	});

	test("uses the current table selection when the edit panel mounts", () => {
		const { CellSelection } = require("prosemirror-tables");
		const editor = {
			commands: { focus: jest.fn() },
			on: jest.fn(),
			off: jest.fn(),
			state: { inTable: true, selection: new CellSelection() },
			view: { dom: document.createElement("div") },
		};
		render(
			createElement(InlineToolbar, {
				editor: editor as never,
				shouldShow: () => true,
			}),
		);

		act(() => mockShouldShow({ editor }));

		expect(screen.getByTestId("inline-edit-panel").getAttribute("data-in-table")).toBe("true");
		expect(screen.getByTestId("inline-edit-panel").getAttribute("data-cell-selection")).toBe("true");
	});

	test("limits the toolbar to the measured article width", () => {
		const dimensions = createArticleDimensions();
		dimensions.setWidth(640);
		const editor = {
			commands: { focus: jest.fn() },
			on: jest.fn(),
			off: jest.fn(),
			state: { inTable: false, selection: {} },
			view: { dom: document.createElement("div") },
		};

		const { container } = render(
			createElement(
				ArticleDimensionsContext.Provider,
				{ value: dimensions },
				createElement(InlineToolbar, {
					editor: editor as never,
					shouldShow: () => true,
				}),
			),
		);

		const toolbar = container.querySelector<HTMLElement>(".article-popover");
		expect(toolbar?.style.getPropertyValue("--article-content-wrapper-width")).toBe("640px");
		expect(toolbar?.style.maxWidth).toBe("var(--article-content-wrapper-width)");
	});

	test("keeps the toolbar inside the article content boundary", () => {
		const articleBoundary = document.createElement("div");
		articleBoundary.className = "article-content-wrapper";
		const editorContainer = document.createElement("div");
		const editorDom = document.createElement("div");
		editorContainer.append(editorDom);
		articleBoundary.append(editorContainer);
		document.body.append(articleBoundary);

		const editor = {
			commands: { focus: jest.fn() },
			on: jest.fn(),
			off: jest.fn(),
			state: { inTable: false, selection: {} },
			view: { dom: editorDom },
		};
		const setProps = jest.fn();
		render(
			createElement(InlineToolbar, {
				editor: editor as never,
				shouldShow: () => true,
			}),
		);

		act(() =>
			mockTippyOptions.onShow({
				popperInstance: { update: jest.fn() },
				setProps,
			}),
		);

		expect(mockTippyOptions.popperOptions).toEqual({
			modifiers: [
				{
					name: "preventOverflow",
					options: {
						boundary: articleBoundary,
						padding: { bottom: 56, left: 48, right: 48, top: 48 },
					},
				},
			],
		});
		expect(setProps).not.toHaveBeenCalled();

		articleBoundary.remove();
	});

	test("mounts the article toolbar beside the editor inside the paint-contained article layout", () => {
		const catalogViewportContent = document.createElement("div");
		catalogViewportContent.className = "catalog-viewport-content";
		const articleLayout = document.createElement("div");
		articleLayout.className = "article-layout";
		const articleBoundary = document.createElement("div");
		articleBoundary.className = "article-content-wrapper";
		const editorContainer = document.createElement("div");
		const editorDom = document.createElement("div");
		editorContainer.append(editorDom);
		articleBoundary.append(editorContainer);
		articleLayout.append(articleBoundary);
		catalogViewportContent.append(articleLayout);
		document.body.append(catalogViewportContent);

		const editor = {
			commands: { focus: jest.fn() },
			on: jest.fn(),
			off: jest.fn(),
			state: { inTable: false, selection: {} },
			view: { dom: editorDom },
		};
		render(
			createElement(InlineToolbar, {
				editor: editor as never,
				shouldShow: () => true,
			}),
		);

		expect(mockTippyOptions.appendTo()).toBe(editorContainer);

		catalogViewportContent.remove();
	});

	test("keeps the inline toolbar below the floating panel layer", () => {
		const editor = {
			commands: { focus: jest.fn() },
			on: jest.fn(),
			off: jest.fn(),
			state: { inTable: false, selection: {} },
			view: { dom: document.createElement("div") },
		};
		render(
			createElement(InlineToolbar, {
				editor: editor as never,
				shouldShow: () => true,
			}),
		);

		expect(mockTippyOptions.zIndex).toBe(49);
	});
});
