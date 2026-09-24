import { act, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { OverflowTooltip, type OverflowTooltipProps } from "./OverflowTooltip";

jest.mock("ics-ui-kit/components/overflow-tooltip", () => ({
	useOverflowTooltip: () => {
		const [open, onOpenChange] = require("react").useState(false);
		const ref = require("react").useRef(null);
		return { onOpenChange, open, ref };
	},
}));
jest.mock("ics-ui-kit/components/tooltip", () => {
	const react = require("react");
	return {
		Tooltip: ({ children, onOpenChange }: { children: React.ReactNode; onOpenChange: (open: boolean) => void }) =>
			react.createElement(
				"div",
				null,
				react.createElement(
					"button",
					{ "data-testid": "open", onClick: () => onOpenChange(true), type: "button" },
					"open",
				),
				children,
			),
		TooltipContent: ({ children, sideOffset }: { children: React.ReactNode; sideOffset?: number }) =>
			react.createElement("div", { "data-side-offset": String(sideOffset), "data-testid": "content" }, children),
		TooltipTrigger: ({ children }: { children: React.ReactNode }) => children,
	};
});

const edges = { boundaryRight: 0, triggerRight: 0 };
let notifyResize: () => void;

const setEdges = (triggerRight: number, boundaryRight: number) => {
	edges.triggerRight = triggerRight;
	edges.boundaryRight = boundaryRight;
};

const renderInRow = (props: Omit<OverflowTooltipProps, "children">) =>
	render(
		createElement(
			"div",
			{ "data-row": "" },
			createElement(OverflowTooltip, props as OverflowTooltipProps, "Гарантийный ремонт товара"),
		),
	);

const sideOffsetOf = () => screen.getByTestId("content").getAttribute("data-side-offset");

const openedSideOffset = () => {
	fireEvent.click(screen.getByTestId("open"));
	return sideOffsetOf();
};

describe("OverflowTooltip", () => {
	beforeEach(() => {
		jest.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
			const right = this.hasAttribute("data-row") ? edges.boundaryRight : edges.triggerRight;
			return { right } as DOMRect;
		});
		jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0);
			return 0;
		});
		globalThis.ResizeObserver = class {
			constructor(callback: () => void) {
				notifyResize = callback;
			}
			observe() {}
			unobserve() {}
			disconnect() {}
		} as unknown as typeof ResizeObserver;
	});

	afterEach(() => jest.restoreAllMocks());

	it("clears the boundary right edge when opened on the right side", () => {
		setEdges(200, 300);
		renderInRow({ offsetBoundarySelector: "[data-row]", side: "right" });

		expect(openedSideOffset()).toBe("108");
	});

	it("adds the boundary distance on top of an explicit side offset", () => {
		setEdges(200, 300);
		renderInRow({ offsetBoundarySelector: "[data-row]", side: "right", sideOffset: 4 });

		expect(openedSideOffset()).toBe("104");
	});

	it("follows the trigger shrinking under an already-open tooltip", () => {
		setEdges(280, 300);
		renderInRow({ offsetBoundarySelector: "[data-row]", side: "right" });
		expect(openedSideOffset()).toBe("28");

		setEdges(232, 300);
		act(() => notifyResize());

		expect(sideOffsetOf()).toBe("76");
	});

	it("leaves the side offset untouched without a boundary selector", () => {
		setEdges(200, 300);
		renderInRow({ side: "right" });

		expect(openedSideOffset()).toBe("undefined");
	});

	it("ignores the boundary on sides other than right", () => {
		setEdges(200, 300);
		renderInRow({ offsetBoundarySelector: "[data-row]", side: "top" });

		expect(openedSideOffset()).toBe("undefined");
	});

	it("ignores a boundary that ends left of the trigger", () => {
		setEdges(300, 200);
		renderInRow({ offsetBoundarySelector: "[data-row]", side: "right" });

		expect(openedSideOffset()).toBe("undefined");
	});
});
