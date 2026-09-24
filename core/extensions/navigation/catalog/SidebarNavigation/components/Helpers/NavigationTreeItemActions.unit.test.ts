import IsMobileService from "@core-ui/ContextServices/isMobileService";
import type { ItemLink } from "@ext/navigation/NavigationLinks";
import { fireEvent, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@ui-kit/Tooltip";
import { createElement } from "react";
import { NavigationTreeItemActions } from "./NavigationTreeItemActions";

jest.mock("@ext/item/EditMenu", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest uses this marker for default-export interop.
	__esModule: true,
	default: () => null,
}));

const renderActions = (isMobile: boolean, isCurrentLink = false) =>
	render(
		IsMobileService.Provider({
			value: isMobile,
			children: createElement(
				TooltipProvider,
				null,
				createElement(
					"div",
					{ "data-testid": "row" },
					createElement(NavigationTreeItemActions, { itemLink: { isCurrentLink } as ItemLink }),
				),
			),
		}),
	);

test.each([false, true])("hides mobile actions after touch and focus (selected: %s)", (isCurrentLink) => {
	renderActions(true, isCurrentLink);
	const row = screen.getByTestId("row");
	fireEvent.pointerEnter(row, { pointerType: "touch" });
	fireEvent.focusIn(row);
	expect(screen.queryByTestId("article-actions")).toBeNull();
});

test("keeps desktop actions available on hover", () => {
	renderActions(false);
	expect(screen.queryByTestId("article-actions")).toBeNull();
	fireEvent.pointerEnter(screen.getByTestId("row"));
	expect(screen.queryByTestId("article-actions")).not.toBeNull();
});
