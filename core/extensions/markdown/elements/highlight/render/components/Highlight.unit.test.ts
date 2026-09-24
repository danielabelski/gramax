import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import Highlight from "./Highlight";

afterEach(cleanup);

describe("Highlight render component", () => {
	it("inherits the text color so it follows the active theme", () => {
		const { container } = render(createElement(Highlight, { color: "orange" }, "text"));
		const span = container.querySelector<HTMLSpanElement>("span[data-highlight]");

		expect(span.dataset.highlight).toBe("orange");
		expect(span.style.color).toBe("");
	});
});
