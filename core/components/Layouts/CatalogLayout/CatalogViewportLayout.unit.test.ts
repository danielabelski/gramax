import { LEFT_NAV_MAX_WIDTH } from "@ext/navigation/catalog/SidebarNavigation/utils/constants";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VIEWPORT_PADDING } from "../../../ui-kit/lib/floating";
import { CatalogViewportLayout } from "./CatalogViewportLayout";

jest.mock("@ui-kit/FloatingPanel", () => ({
	FloatingPanelLayout: ({
		children,
		contentClassName,
		reserveRightUnderlay,
		rightDockedZoneInset,
		rightZoneUnderlay,
		rightZoneUnderlayWidth,
	}: {
		children: ReactNode;
		contentClassName: string;
		reserveRightUnderlay: boolean;
		rightDockedZoneInset: number;
		rightZoneUnderlay: ReactNode;
		rightZoneUnderlayWidth: number | string;
	}) =>
		require("react").createElement(
			"div",
			{
				className: contentClassName,
				"data-reserve-right-underlay": reserveRightUnderlay,
				"data-right-docked-zone-inset": rightDockedZoneInset,
				"data-right-zone-underlay-width": rightZoneUnderlayWidth,
			},
			children,
			rightZoneUnderlay,
		),
}));

describe("CatalogViewportLayout", () => {
	it("keeps the query and compensation widths stable when both navigations always fit", () => {
		const TestLayout = () => CatalogViewportLayout({ rightNavigation: null, children: "article" });
		const markup = renderToStaticMarkup(createElement(TestLayout));
		const viewport = new DOMParser().parseFromString(markup, "text/html").body.firstElementChild;
		const queryContainer = viewport.firstElementChild;
		const stableWidth = `[@container_catalog-layout_(min-width:_${1024 + LEFT_NAV_MAX_WIDTH}px)]:!w-full`;

		expect(viewport.classList).toContain("[container-name:catalog-layout]");
		expect(viewport.classList).toContain("[container-type:inline-size]");
		expect(queryContainer.classList).toContain(stableWidth);
		expect(queryContainer.firstElementChild.classList).toContain(stableWidth);
	});

	it("always reserves the left navigation width and viewport padding for the side-zone resize boundary", () => {
		const TestLayout = () => CatalogViewportLayout({ rightNavigation: null, children: "article" });
		const markup = renderToStaticMarkup(createElement(TestLayout));
		const document = new DOMParser().parseFromString(markup, "text/html");
		const resizeBoundary = document.querySelector("[data-side-zone-resize-boundary]");

		expect(resizeBoundary?.getAttribute("style")).toContain(
			`left:calc(var(--left-nav-width) + ${VIEWPORT_PADDING}px)`,
		);
		expect(resizeBoundary?.className).not.toContain("data-left-sidebar-pinned");
	});
	it("does not broadcast changing article insets from the viewport ancestors", () => {
		const TestLayout = () =>
			CatalogViewportLayout({
				children: createElement("article", null, "Article"),
				rightNavigation: null,
			});
		const markup = renderToStaticMarkup(createElement(TestLayout));
		const document = new DOMParser().parseFromString(markup, "text/html");
		let ancestor = document.querySelector("article").parentElement;
		while (ancestor && ancestor !== document.body) {
			expect(ancestor.className).not.toContain("--article-layout-side-inset:");
			expect(ancestor.className).not.toContain("--catalog-right-navigation-reserved-width:");
			ancestor = ancestor.parentElement;
		}
	});
	it("renders the responsive navigation without choosing a JS layout state", () => {
		const TestLayout = () =>
			CatalogViewportLayout({
				children: "article",
				rightNavigation: createElement("nav", null, "Right navigation"),
			});
		const markup = renderToStaticMarkup(createElement(TestLayout));
		const document = new DOMParser().parseFromString(markup, "text/html");

		const viewport = document.body.firstElementChild;
		const queryContainer = viewport?.firstElementChild;

		expect(document.querySelector("nav")?.textContent).toBe("Right navigation");
		expect(queryContainer?.hasAttribute("data-left-sidebar-pinned")).toBe(false);
		expect(queryContainer?.classList).toContain("[container-name:catalog-viewport]");
		expect(queryContainer?.classList).toContain("[container-type:inline-size]");
		expect(queryContainer?.classList).toContain(
			"[html[data-left-sidebar-pinned=true]_&]:w-[calc(100%_-_var(--left-nav-width))]",
		);
	});

	it("does not hide the page while CSS resolves the initial layout", () => {
		const TestLayout = () =>
			CatalogViewportLayout({
				children: "article",
				rightNavigation: null,
			});
		const markup = renderToStaticMarkup(createElement(TestLayout));
		const layout = new DOMParser().parseFromString(markup, "text/html").body.firstElementChild;

		expect(layout?.classList.contains("invisible")).toBe(false);
		const content = layout?.querySelector(".catalog-viewport-content");
		expect(content?.classList).toContain("[&_.article-layout]:pl-0");
		expect(content?.classList).toContain("[&_.article-layout]:pr-0");
		expect(content?.classList).toContain(
			"lg:[html[data-left-sidebar-pinned=true]_&]:[&_.article-layout]:pl-[var(--left-nav-width)]",
		);
	});

	it("reserves right navigation through a container query before hydration", () => {
		const TestLayout = () =>
			CatalogViewportLayout({
				children: "article",
				rightNavigation: null,
			});
		const markup = renderToStaticMarkup(createElement(TestLayout));
		const document = new DOMParser().parseFromString(markup, "text/html");
		const content = document.querySelector(".catalog-viewport-content");

		expect(content?.classList).toContain(
			"[@container_catalog-viewport_(min-width:_1024px)]:[html[data-left-sidebar-pinned=true]_&]:[&_.article-layout]:pr-[var(--catalog-right-navigation-width)]",
		);
	});

	it("reserves the right-navigation content width and its viewport padding", () => {
		const TestLayout = () =>
			CatalogViewportLayout({
				children: "article",
				rightNavigation: null,
			});
		const markup = renderToStaticMarkup(createElement(TestLayout));
		const document = new DOMParser().parseFromString(markup, "text/html");

		expect(
			(document.body.firstElementChild as HTMLElement).style.getPropertyValue("--catalog-right-navigation-width"),
		).toBe("256px");
		expect(document.querySelector(".catalog-viewport-content")?.classList).toContain(
			"[@container_catalog-viewport_(min-width:_1284px)]:[html[data-left-sidebar-pinned=false]_&]:[&_.article-layout]:px-[var(--catalog-right-navigation-width)]",
		);
	});

	it("keeps one viewport padding between the dock zone and navigation controls", () => {
		const TestLayout = () =>
			CatalogViewportLayout({
				children: "article",
				rightNavigation: null,
			});
		const markup = renderToStaticMarkup(createElement(TestLayout));
		const document = new DOMParser().parseFromString(markup, "text/html");

		expect(document.querySelector(".catalog-viewport-content")?.getAttribute("data-right-docked-zone-inset")).toBe(
			"56",
		);
	});

	it("does not pass a changing inherited underlay width into the article", () => {
		const TestLayout = () =>
			CatalogViewportLayout({
				children: createElement("article", null, "article content"),
				rightNavigation: null,
			});
		const markup = renderToStaticMarkup(createElement(TestLayout));
		const document = new DOMParser().parseFromString(markup, "text/html");
		const floatingPanelLayout = document.querySelector(".catalog-viewport-content");

		expect(floatingPanelLayout?.hasAttribute("data-reserve-right-underlay")).toBe(false);
		expect(floatingPanelLayout?.hasAttribute("data-right-zone-underlay-width")).toBe(false);
	});
});
