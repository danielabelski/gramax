import { render } from "@testing-library/react";
import { createElement } from "react";
import { VIEWPORT_PADDING } from "../../../../ui-kit/lib/floating";
import { RIGHT_NAVIGATION_WIDTH } from "./constants";
import RightNavigation from "./RightNavigation";

let mockCanSeeNavigationBottom = false;

jest.mock("@core-ui/stores/ArticlePropsStore/ArticlePropsStore.provider", () => ({
	useArticlePropsStore: () => undefined,
}));
jest.mock("@core-ui/hooks/usePlatform", () => ({
	usePlatform: () => ({ isNext: true }),
}));
jest.mock("../useCanSeeNavigationBottom", () => ({
	useCanSeeNavigationBottom: () => mockCanSeeNavigationBottom,
}));
jest.mock("./sections/ArticlePropertiesSection", () => ({ ArticlePropertiesSection: () => null }));
jest.mock("./sections/CatalogSection", () => ({ CatalogSection: () => null }));
jest.mock("./sections/LinksSection", () => ({ LinksSection: () => null }));
jest.mock("@ext/navigation/article/render/TableOfContents", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ES module mock marker
	__esModule: true,
	default: () => null,
}));

describe("RightNavigation", () => {
	beforeEach(() => {
		mockCanSeeNavigationBottom = false;
	});

	it("leaves the article scrollbar visible in the right viewport margin", () => {
		const { container } = render(createElement(RightNavigation));
		const navigation = container.querySelector<HTMLElement>(".article-right-sidebar");

		expect(navigation?.style.width).toBe(`${RIGHT_NAVIGATION_WIDTH + VIEWPORT_PADDING}px`);
		expect(navigation?.style.paddingLeft).toBe(`${VIEWPORT_PADDING}px`);
		expect(navigation?.style.paddingRight).toBe("");
		expect(navigation?.style.marginRight).toBe(`${VIEWPORT_PADDING}px`);
		expect(navigation?.classList.contains("bg-[var(--color-article-bg)]")).toBe(true);
	});

	it("places the Gramax link at the viewport edge when there are no bottom controls", () => {
		const { container } = render(createElement(RightNavigation));

		expect(container.querySelector<HTMLElement>(".article-right-sidebar")?.style.paddingBottom).toBe(
			`${VIEWPORT_PADDING}px`,
		);
	});

	it("reserves the bottom controls height above the Gramax link", () => {
		mockCanSeeNavigationBottom = true;
		const { container } = render(createElement(RightNavigation));

		expect(container.querySelector<HTMLElement>(".article-right-sidebar")?.style.paddingBottom).toBe("56px");
	});
});
