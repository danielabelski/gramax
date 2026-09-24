import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@ui-kit/Tooltip";
import { createElement } from "react";
import { PropertyTypes } from "../models";
import Property from "./Property";

describe("Property", () => {
	it("shows the first value and a count for compact multi-value properties", () => {
		const { container } = render(
			createElement(
				TooltipProvider,
				null,
				createElement(Property, {
					collapseValues: true,
					maxWidth: 160,
					name: "Assignee",
					type: PropertyTypes.many,
					value: ["SY", "AL", "Epic"],
				}),
			),
		);

		expect(screen.getByText("SY")).toBeTruthy();
		expect(screen.getByText("+2")).toBeTruthy();
		expect((container.firstElementChild as HTMLElement).style.maxWidth).toBe("160px");
	});
});
