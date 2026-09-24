import { fireEvent, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@ui-kit/Tooltip";
import { createElement } from "react";
import {
	Tree,
	TreeActions,
	TreeCheckbox,
	TreeIndicator,
	TreeIndicatorBar,
	TreeMeta,
	TreeRow,
	TreeTitle,
	TreeTrailing,
} from ".";

type TestItem = {
	id: string;
	title: string;
	color?: string;
	children?: TestItem[];
};

const items: TestItem[] = [
	{
		id: "parent",
		title: "Parent",
		children: [{ id: "child", title: "Child", color: "red" }],
	},
];

describe("Tree composition", () => {
	it("renders generic nested items through the consumer composition", () => {
		render(
			createElement(
				TooltipProvider,
				null,
				createElement(Tree<TestItem>, {
					items,
					// biome-ignore lint/correctness/noChildrenProp: expected
					children: ({ item, depth }) =>
						createElement(TreeRow, { depth, item }, createElement(TreeTitle, null, item.title)),
				}),
			),
		);

		expect(screen.getByText("Parent").closest("[data-depth]")?.getAttribute("data-depth")).toBe("0");
		expect(screen.getByText("Child").closest("[data-depth]")?.getAttribute("data-depth")).toBe("1");
	});

	it("allows the indicator to be wrapped with arbitrary consumer content", () => {
		render(
			createElement(
				TreeRow,
				{ depth: 0, item: items[0].children?.[0] },
				createElement(
					TreeIndicator,
					null,
					createElement(
						"span",
						{ "data-testid": "indicator-tooltip" },
						createElement(TreeIndicatorBar, { color: "red" }),
					),
				),
			),
		);

		expect(screen.getByTestId("indicator-tooltip").contains(screen.getByTestId("tree-indicator-bar"))).toBe(true);
	});

	it("keeps checkbox clicks separate from row clicks", () => {
		const onClick = jest.fn();
		const onSelect = jest.fn();

		render(createElement(TreeRow, { depth: 0, item: items[0], onClick, onSelect }, createElement(TreeCheckbox)));

		fireEvent.click(screen.getByRole("checkbox"));

		expect(onSelect).toHaveBeenCalledWith(true);
		expect(onClick).not.toHaveBeenCalled();
	});

	it("renders independently composed trailing content", () => {
		render(
			createElement(
				TooltipProvider,
				null,
				createElement(
					TreeRow,
					{ depth: 0, item: items[0] },
					createElement(TreeTitle, null, items[0].title),
					createElement(
						TreeTrailing,
						null,
						createElement(TreeMeta, null, "2 changes"),
						createElement(TreeActions, null, "Discard"),
					),
				),
			),
		);

		expect(screen.getByText("Parent")).toBeTruthy();
		expect(screen.getByText("2 changes").parentElement?.parentElement).toBe(
			screen.getByText("Discard").parentElement?.parentElement,
		);
	});
});
