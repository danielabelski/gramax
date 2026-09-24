import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import { ActionReveal } from "./ActionReveal";

describe("ActionReveal", () => {
	it("keeps its content mounted while changing the revealed state", () => {
		const action = createElement("button", { type: "button" }, "Action");
		const { container, rerender } = render(
			createElement(ActionReveal, { isVisible: false, width: "1.5rem" }, action),
		);

		const wrapper = container.firstElementChild;
		expect(wrapper?.getAttribute("data-state")).toBe("hidden");
		expect(screen.queryByRole("button", { name: "Action" })).not.toBeNull();

		rerender(createElement(ActionReveal, { isVisible: true, width: "1.5rem" }, action));

		expect(wrapper?.getAttribute("data-state")).toBe("visible");
		expect(wrapper?.getAttribute("style")).toContain("--action-reveal-width: 1.5rem");
	});
});
