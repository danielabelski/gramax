import { fireEvent, render, screen } from "@testing-library/react";
import { act, createElement } from "react";
import { useCollapsedNavigationPresentation } from "./useCollapsedNavigationPresentation";

const PresentationHarness = ({
	isCollapsed,
	shouldCollapseImmediately = false,
}: {
	isCollapsed: boolean;
	shouldCollapseImmediately?: boolean;
}) => {
	const { handleTransitionEnd, isCollapsedPresentation } = useCollapsedNavigationPresentation(
		isCollapsed,
		shouldCollapseImmediately,
	);

	return createElement(
		"div",
		{
			"data-collapsed-presentation": isCollapsedPresentation,
			"data-testid": "sidebar",
			onTransitionEnd: handleTransitionEnd,
		},
		createElement("div", { "data-testid": "sidebar-child" }),
	);
};

const expectCollapsedPresentation = (expected: boolean) => {
	expect(screen.getByTestId("sidebar").getAttribute("data-collapsed-presentation")).toBe(String(expected));
};

const dispatchTransitionEnd = (element: HTMLElement, propertyName: string) => {
	const event = new Event("transitionend", { bubbles: true });
	Object.defineProperty(event, "propertyName", { value: propertyName });
	fireEvent(element, event);
};

describe("useCollapsedNavigationPresentation", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
	});

	it("keeps the expanded presentation until the sidebar finishes leaving", () => {
		const { rerender } = render(createElement(PresentationHarness, { isCollapsed: false }));

		rerender(createElement(PresentationHarness, { isCollapsed: true }));
		expectCollapsedPresentation(false);

		void act(() => {
			jest.advanceTimersByTime(10_000);
		});
		expectCollapsedPresentation(false);

		dispatchTransitionEnd(screen.getByTestId("sidebar"), "left");
		expectCollapsedPresentation(true);
	});

	it("ignores transitions that do not finish the sidebar movement", () => {
		const { rerender } = render(createElement(PresentationHarness, { isCollapsed: false }));
		rerender(createElement(PresentationHarness, { isCollapsed: true }));

		dispatchTransitionEnd(screen.getByTestId("sidebar"), "width");
		expectCollapsedPresentation(false);

		dispatchTransitionEnd(screen.getByTestId("sidebar-child"), "left");
		expectCollapsedPresentation(false);

		dispatchTransitionEnd(screen.getByTestId("sidebar"), "left");
		expectCollapsedPresentation(true);
	});

	it("cancels the collapsed presentation when the sidebar reopens", () => {
		const { rerender } = render(createElement(PresentationHarness, { isCollapsed: false }));

		rerender(createElement(PresentationHarness, { isCollapsed: true }));
		rerender(createElement(PresentationHarness, { isCollapsed: false }));
		dispatchTransitionEnd(screen.getByTestId("sidebar"), "left");

		expectCollapsedPresentation(false);
	});

	it("switches immediately when reduced motion is enabled", () => {
		jest.spyOn(window, "matchMedia").mockReturnValue({ matches: true } as MediaQueryList);
		const { rerender } = render(createElement(PresentationHarness, { isCollapsed: false }));

		rerender(createElement(PresentationHarness, { isCollapsed: true }));

		expectCollapsedPresentation(true);
	});

	it("switches immediately when the collapse has no desktop transition", () => {
		const { rerender } = render(createElement(PresentationHarness, { isCollapsed: false }));

		rerender(
			createElement(PresentationHarness, {
				isCollapsed: true,
				shouldCollapseImmediately: true,
			}),
		);

		expectCollapsedPresentation(true);
	});

	it("finishes a pending collapse when reduced motion is enabled", () => {
		let handleReducedMotionChange = () => undefined;
		const mediaQueryList = {
			matches: false,
			addEventListener: (_type: string, listener: () => void) => {
				handleReducedMotionChange = listener;
			},
			removeEventListener: jest.fn(),
		} as unknown as MediaQueryList;
		jest.spyOn(window, "matchMedia").mockReturnValue(mediaQueryList);
		const { rerender } = render(createElement(PresentationHarness, { isCollapsed: false }));

		rerender(createElement(PresentationHarness, { isCollapsed: true }));
		expectCollapsedPresentation(false);

		Object.defineProperty(mediaQueryList, "matches", { configurable: true, value: true });
		void act(handleReducedMotionChange);

		expectCollapsedPresentation(true);
	});
});
