import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { VIEWPORT_PADDING } from "../../../../ui-kit/lib/floating";
import { RIGHT_NAVIGATION_WIDTH } from "./constants";
import RightNavigationLayout from "./RightNavigationLayout";

describe("RightNavigationLayout", () => {
	it("reserves the macOS Tauri titlebar offset", () => {
		render(createElement(RightNavigationLayout, null, createElement("div", null, "navigation")));

		const navigation = screen.getByText("navigation").parentElement;
		expect(navigation?.classList.contains("h-full")).toBe(true);
		expect(navigation?.classList.contains("pt-[calc(3.25rem+var(--catalog-titlebar-offset))]")).toBe(false);
		expect(navigation?.classList.contains("pb-[3.25rem]")).toBe(false);
		expect(navigation?.classList.contains("mt-[calc(3.25rem+var(--catalog-titlebar-offset))]")).toBe(false);
	});

	it("contains the fixed navigation width and its viewport padding", () => {
		render(createElement(RightNavigationLayout, null, createElement("div", null, "navigation")));

		expect(screen.getByText("navigation").parentElement?.style.width).toBe(
			`${RIGHT_NAVIGATION_WIDTH + VIEWPORT_PADDING * 2}px`,
		);
	});

	it("keeps the right viewport gap transparent", () => {
		render(createElement(RightNavigationLayout, null, createElement("div", null, "navigation")));

		expect(screen.getByText("navigation").parentElement?.classList.contains("bg-[var(--color-article-bg)]")).toBe(
			false,
		);
	});
});
