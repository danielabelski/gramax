/** biome-ignore-all lint/style/useNamingConvention: Jest ESM mock markers */
import { ArticleMarkdownRenderer } from "@components/Article/ArticleMarkdownRenderer";
import type { MarkdownArticlePageData } from "@core/SitePresenter/types/ArticlePage";
import { act, render, screen } from "@testing-library/react";
import { createElement } from "react";

const mockFetch = jest.fn();
const mockSetArticleContent = jest.fn((path: string) => path);

jest.mock("@core-ui/ApiServices/FetchService", () => ({
	__esModule: true,
	default: { fetch: (...args: unknown[]) => mockFetch(...args) },
}));

jest.mock("@core-ui/ContextServices/ApiUrlCreator", () => ({
	__esModule: true,
	default: { value: { setArticleContent: (path: string) => mockSetArticleContent(path) } },
}));

jest.mock("@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider", () => ({
	useArticlePropsStore: (selector: (state: unknown) => unknown) => selector({ data: { template: null } }),
}));

jest.mock("@components/Atoms/FileInput/FileInput", () => {
	const { createElement, useEffect, useMemo, useRef, useState } = jest.requireActual<typeof import("react")>("react");

	return {
		__esModule: true,
		default: ({
			value,
			onChange,
			onMount,
		}: {
			value: string;
			onChange?: (value: string) => void;
			onMount?: (editor: {
				getValue: () => string;
				setValue: (value: string) => void;
				updateOptions: () => void;
			}) => void;
		}) => {
			const valueRef = useRef(value);
			const onChangeRef = useRef(onChange);
			const onMountRef = useRef(onMount);
			onChangeRef.current = onChange;
			const [editorValue, setEditorValue] = useState(value);
			const editor = useMemo(
				() => ({
					getValue: () => valueRef.current,
					setValue: (nextValue: string) => {
						valueRef.current = nextValue;
						setEditorValue(nextValue);
						onChangeRef.current?.(nextValue);
					},
					updateOptions: () => undefined,
				}),
				[],
			);

			useEffect(() => onMountRef.current?.(editor), [editor, onMountRef]);

			return createElement("div", { "data-testid": "markdown-editor" }, editorValue);
		},
	};
});

const createArticle = (path: string, content: string) =>
	({
		mode: "markdown",
		content,
		articleProps: { ref: { path } },
	}) as MarkdownArticlePageData;

describe("ArticleMarkdownRenderer", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		mockFetch.mockClear();
		mockSetArticleContent.mockClear();
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	test("switches the mounted editor to another article without saving the programmatic update", () => {
		const view = render(
			createElement(ArticleMarkdownRenderer, {
				data: createArticle("first.md", "first content"),
				isReadOnly: false,
			}),
		);
		expect(screen.getByTestId("markdown-editor").textContent).toBe("first content");

		view.rerender(
			createElement(ArticleMarkdownRenderer, {
				data: createArticle("second.md", "second content"),
				isReadOnly: false,
			}),
		);
		act(() => jest.advanceTimersByTime(500));

		expect(screen.getByTestId("markdown-editor").textContent).toBe("second content");
		expect(mockFetch).not.toHaveBeenCalled();
	});
});
