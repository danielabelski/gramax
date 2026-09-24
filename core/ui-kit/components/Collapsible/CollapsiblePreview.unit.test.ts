import { render } from "@testing-library/react";
import { createElement } from "react";
import { CollapsiblePreview } from "./CollapsiblePreview";

describe("CollapsiblePreview", () => {
	afterEach(() => jest.restoreAllMocks());

	it("animates between the preview height and the full content height", () => {
		jest.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(96);

		const { rerender } = render(
			createElement(CollapsiblePreview, { collapsedHeight: 32, id: "content", open: false }, "Long content"),
		);

		expect(document.getElementById("content")?.style.height).toBe("32px");

		rerender(createElement(CollapsiblePreview, { collapsedHeight: 32, id: "content", open: true }, "Long content"));

		expect(document.getElementById("content")?.style.height).toBe("96px");
	});

	it("reports whether the content exceeds the preview height", () => {
		const onCanExpandChange = jest.fn();
		jest.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(48);

		render(
			createElement(CollapsiblePreview, { collapsedHeight: 32, onCanExpandChange, open: false }, "Long content"),
		);

		expect(onCanExpandChange).toHaveBeenLastCalledWith(true);
	});
});
