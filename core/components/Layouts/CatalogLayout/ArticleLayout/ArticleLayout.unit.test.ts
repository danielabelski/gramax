import { act, render } from "@testing-library/react";
import { createElement } from "react";
import ArticleLayout from "./ArticleLayout";
import { useArticleWidthStyle } from "./useArticleDimensions";

jest.mock("@core-ui/ContextServices/ArticleRef", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: { value: { current: null } },
}));

jest.mock("@ext/git/core/Diff/components/ArticleBreadcrumbDiffLine", () => ({
	ArticleBreadcrumbDiffLine: () => null,
}));

class ResizeObserverMock {
	static instances: ResizeObserverMock[] = [];
	target: Element;
	constructor(private _callback: ResizeObserverCallback) {
		ResizeObserverMock.instances.push(this);
	}
	observe(target: Element) {
		this.target = target;
	}
	unobserve(_target: Element) {}
	disconnect() {}
	resize(width: number, height: number) {
		this._callback(
			[{ target: this.target, contentRect: { width, height } } as ResizeObserverEntry],
			this as unknown as ResizeObserver,
		);
	}
}

describe("ArticleLayout", () => {
	const originalResizeObserver = global.ResizeObserver;
	beforeAll(() => {
		global.ResizeObserver = ResizeObserverMock as typeof ResizeObserver;
	});
	afterAll(() => {
		global.ResizeObserver = originalResizeObserver;
	});

	it("updates only width consumers without rerendering article content", () => {
		const renderArticle = jest.fn();
		const renderConsumer = jest.fn();
		const Consumer = () => {
			renderConsumer();
			return createElement("div", { "data-testid": "wide-block", style: useArticleWidthStyle() });
		};
		const Article = () => {
			renderArticle();
			return createElement("main", null, createElement("p", null, "article text"), createElement(Consumer));
		};
		const { getByTestId, container } = render(
			createElement(ArticleLayout, {
				article: createElement(Article),
				useArticleDefaultStyles: true,
			}),
		);
		const observer = ResizeObserverMock.instances.at(-1);
		act(() => observer.resize(900, 600));
		expect(getByTestId("wide-block").style.getPropertyValue("--article-content-wrapper-width")).toBe("900px");
		const renders = renderConsumer.mock.calls.length;
		act(() => observer.resize(900, 800));
		expect(renderConsumer).toHaveBeenCalledTimes(renders);
		act(() => observer.resize(700, 800));
		expect(getByTestId("wide-block").style.getPropertyValue("--article-content-wrapper-width")).toBe("700px");
		expect(renderArticle).toHaveBeenCalledTimes(1);
		expect(container.querySelector<HTMLElement>(".article-content-wrapper").style.length).toBe(0);
	});

	it("disables containment for printing", () => {
		render(createElement(ArticleLayout, { article: createElement("div"), useArticleDefaultStyles: true }));
		const printRules = Array.from(document.styleSheets)
			.flatMap((sheet) => Array.from(sheet.cssRules))
			.filter((rule) => rule instanceof CSSMediaRule && rule.conditionText === "print")
			.map((rule) => rule.cssText)
			.join("\n");
		expect(printRules).toContain("contain: none");
	});

	it("ships the narrow layout in CSS before hydration", () => {
		render(
			createElement(ArticleLayout, {
				article: createElement("div", null, "long article"),
				useArticleDefaultStyles: true,
			}),
		);

		const styles = Array.from(document.styleSheets, (sheet) =>
			Array.from(sheet.cssRules, (rule) => rule.cssText).join("\n"),
		).join("\n");
		expect(styles).toContain("@media only screen and (max-width: 62rem)");
		expect(styles).toMatch(/max-width:\s*100%/);
		expect(styles).toMatch(/min-width:\s*100%/);
	});

	it("keeps article content below the top controls until the navigation is pinned", () => {
		const { container } = render(
			createElement(ArticleLayout, {
				article: createElement("div", null, "article"),
				useArticleDefaultStyles: true,
			}),
		);

		const styles = Array.from(document.styleSheets, (sheet) =>
			Array.from(sheet.cssRules, (rule) => rule.cssText).join("\n"),
		).join("\n");
		const contentWrapper = container.querySelector(".article-content-wrapper");
		expect(contentWrapper).not.toBeNull();
		expect(contentWrapper?.classList).not.toContain("pt-4");
		expect(styles).toContain("@media only screen and (max-width: 63.999rem)");
		expect(styles).toContain("padding-top: calc(4.375rem + var(--catalog-titlebar-offset,0rem))");
	});

	it("centers article content in the narrow layout", () => {
		render(
			createElement(ArticleLayout, {
				article: createElement("div", null, "article"),
				useArticleDefaultStyles: true,
			}),
		);

		const styles = Array.from(document.styleSheets, (sheet) =>
			Array.from(sheet.cssRules, (rule) => rule.cssText).join("\n"),
		).join("\n");
		expect(styles).toMatch(/\.article-content-wrapper\s*\{[^}]*justify-content:\s*center/);
	});

	it("animates the article inset when docking and undocking navigation", () => {
		const { getByTestId } = render(
			createElement(ArticleLayout, {
				article: createElement("div", null, "article"),
				useArticleDefaultStyles: true,
			}),
		);

		const styles = getComputedStyle(getByTestId("article-scroll-container"));
		expect(styles.transition).toBe("padding 300ms ease-out");
		expect(styles.contain).toBe("layout paint");
	});

	it("does not publish an inherited width variable through the article", () => {
		const { container } = render(
			createElement(ArticleLayout, {
				article: createElement("div", null, "article"),
				useArticleDefaultStyles: true,
			}),
		);
		const wrapper = container.querySelector<HTMLElement>(".article-content-wrapper");
		const observer = ResizeObserverMock.instances.at(-1);
		const setProperty = jest.spyOn(wrapper.style, "setProperty");
		act(() => observer.resize(900, 600));
		expect(wrapper.style.getPropertyValue("--article-content-wrapper-width")).toBe("");
		setProperty.mockClear();
		act(() => observer.resize(900, 800));
		expect(setProperty).not.toHaveBeenCalled();
		act(() => observer.resize(700, 800));
		expect(wrapper.style.getPropertyValue("--article-content-wrapper-width")).toBe("");
		setProperty.mockRestore();
	});

	it("uses only the right navigation underlay to inset content", () => {
		render(
			createElement(ArticleLayout, {
				article: createElement("div", null, "article"),
				useArticleDefaultStyles: true,
			}),
		);

		const styles = Array.from(document.styleSheets, (sheet) =>
			Array.from(sheet.cssRules, (rule) => rule.cssText).join("\n"),
		).join("\n");
		expect(styles).toContain(
			"padding-right: var(--right-zone-underlay-width, var(--article-layout-side-inset, 0px))",
		);
	});
});
