import { fireEvent, render, screen } from "@testing-library/react";
import { GlassToolbar } from "@ui-kit/GlassToolbar";
import { Popover, PopoverContent, PopoverTrigger } from "@ui-kit/Popover";
import { TooltipProvider } from "@ui-kit/Tooltip";
import { createElement } from "react";
import { CollapsedNavigationTrigger } from "./CollapsedNavigationTrigger";

describe("CollapsedNavigationTrigger", () => {
	it("forwards click props when used through Radix asChild", () => {
		render(
			createElement(
				TooltipProvider,
				null,
				createElement(
					GlassToolbar,
					null,
					createElement(
						Popover,
						null,
						createElement(
							PopoverTrigger,
							{ asChild: true },
							createElement(CollapsedNavigationTrigger, { icon: "layout-grid", label: "catalog view" }),
						),
						createElement(PopoverContent, null, "catalog content"),
					),
				),
			),
		);

		fireEvent.click(screen.getByRole("button", { name: "catalog view" }));
		expect(screen.getByText("catalog content")).toBeTruthy();
	});
});
