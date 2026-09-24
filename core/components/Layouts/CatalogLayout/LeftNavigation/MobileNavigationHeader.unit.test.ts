import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { VIEWPORT_PADDING } from "../../../../ui-kit/lib/floating";
import { MobileNavigationHeader } from "./MobileNavigationHeader";

const renderHeader = () => {
	render(createElement(MobileNavigationHeader, null, createElement("button", { type: "button" }, "navigation")));
	return screen.getByRole("button", { name: "navigation" }).parentElement;
};

describe("MobileNavigationHeader", () => {
	it("only occupies the width of its compact navigation controls", () => {
		const overlay = renderHeader();

		expect(overlay?.classList.contains("w-fit")).toBe(true);
		expect(overlay?.classList.contains("w-full")).toBe(false);
	});

	// `top` is not asserted: it is a `calc()` over `--catalog-titlebar-offset`, and jsdom drops any
	// declaration whose calc() contains a custom property.
	it("keeps its controls a viewport padding away from the viewport corner", () => {
		const overlay = renderHeader();

		expect(overlay?.style.left).toBe(`${VIEWPORT_PADDING}px`);
	});
});
