import { InlineLinkMenu } from "@ext/markdown/elements/link/edit/components/LinkMenu/InlineLinkMenu";
import { render } from "@testing-library/react";
import { createElement, type ReactNode } from "react";

interface MockTippyOptions {
	appendTo: () => HTMLElement | null;
	moveTransition?: string;
	popperOptions: {
		modifiers: {
			name: string;
			options: { boundary: HTMLElement | string; padding?: Record<string, number> };
		}[];
	};
}

let mockTippyOptions: MockTippyOptions;
let mockShouldShow: () => boolean;
const mockFlushSync = jest.fn((callback: () => void) => callback());

jest.mock("react-dom", () => ({
	...jest.requireActual("react-dom"),
	flushSync: (callback: () => void) => mockFlushSync(callback),
}));

jest.mock("@core-ui/hooks/useMediaQuery", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest requires this ESM marker.
	__esModule: true,
	default: () => false,
}));
jest.mock("@core-ui/hooks/useEscapeKeyDown", () => ({ useEscapeKeydown: () => {} }));
jest.mock("@ext/markdown/elements/link/edit/hooks/useLinkMenuState", () => ({
	useLinkMenuState: () => ({
		mark: { attrs: { href: "/article" } },
		isOpen: true,
		shouldShow: () => true,
		onUpdate: jest.fn(),
		reset: jest.fn(),
		getMark: jest.fn(),
		handleDelete: jest.fn(),
	}),
}));
jest.mock("@ext/markdown/elements/link/edit/components/LinkMenu/LinkMenu", () => ({ LinkMenu: () => null }));
jest.mock("@ext/markdown/elements/customBubbleMenu/edit/components/CustomBubbleMenu", () => ({
	CustomBubbleMenu: ({
		children,
		shouldShow,
		tippyOptions,
	}: {
		children: ReactNode;
		shouldShow: () => boolean;
		tippyOptions: MockTippyOptions;
	}) => {
		mockTippyOptions = tippyOptions;
		mockShouldShow = shouldShow;
		return children;
	},
}));

describe("InlineLinkMenu", () => {
	it("keeps the link menu and its shadow inside the article content", () => {
		const articleBoundary = document.createElement("div");
		articleBoundary.className = "article-content-wrapper";
		const editorContainer = document.createElement("div");
		const editorDom = document.createElement("div");
		editorContainer.append(editorDom);
		articleBoundary.append(editorContainer);
		document.body.append(articleBoundary);

		const editor = {
			state: { selection: { empty: true, from: 1 }, doc: { content: { size: 2 } } },
			view: { dom: editorDom },
		};
		render(createElement(InlineLinkMenu, { editor: editor as never }));

		expect(mockTippyOptions.appendTo()).toBe(editorContainer);
		const preventOverflow = mockTippyOptions.popperOptions.modifiers.find(
			(modifier) => modifier.name === "preventOverflow",
		);
		expect(preventOverflow?.options).toEqual({
			altAxis: true,
			boundary: articleBoundary,
			padding: { bottom: 56, left: 48, right: 48, top: 48 },
		});
		expect(mockTippyOptions.moveTransition).toBeUndefined();
		expect(mockShouldShow()).toBe(true);
		expect(mockFlushSync).toHaveBeenCalledTimes(1);

		articleBoundary.remove();
	});
});
