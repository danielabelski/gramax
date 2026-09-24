import { useSidebarsWidthStore } from "@core-ui/ContextServices/Sidebars/SidebarsWidthStore";
import { navigationTreeStore } from "@ext/navigation/catalog/SidebarNavigation/store/navigationTreeStore";
import {
	LEFT_NAV_DEFAULT_WIDTH,
	LEFT_NAV_MAX_WIDTH,
	LEFT_NAV_MIN_WIDTH,
} from "@ext/navigation/catalog/SidebarNavigation/utils/constants";
import { act, fireEvent, render } from "@testing-library/react";
import { SidebarProvider } from "@ui-kit/Sidebar";
import { TooltipProvider } from "@ui-kit/Tooltip";
import { type CSSProperties, createElement, createRef, type ReactElement, type TransitionEvent } from "react";
import LeftNavigationLayout from "./LeftNavigationLayout";

// ics-ui-kit 0.1.15 dropped the TooltipProvider that SidebarProvider used to render for the collapsed trigger.
const renderWithTooltips = (ui: ReactElement) => render(ui, { wrapper: TooltipProvider });

describe("LeftNavigationLayout", () => {
	beforeEach(() => {
		navigationTreeStore.getState().setHoveredNavigationId(null);
		jest.spyOn(window, "matchMedia").mockImplementation(
			(query) =>
				({
					matches: query === "(min-width: 1024px)",
					media: query,
					onchange: null,
					addEventListener: jest.fn(),
					removeEventListener: jest.fn(),
					addListener: jest.fn(),
					removeListener: jest.fn(),
					dispatchEvent: jest.fn(),
				}) as MediaQueryList,
		);
	});

	it("keeps the hidden position under local control", () => {
		const content = createElement("div", null, "navigation content");
		const layout = createElement(LeftNavigationLayout, {
			isCollapsed: true,
			isVisible: false,
			leftNavigationContent: content,
		});

		const { container } = renderWithTooltips(createElement(SidebarProvider, null, layout));
		const sidebar = container.querySelector<HTMLElement>("[data-sidebar=sidebar]")?.parentElement;

		expect(sidebar?.classList.contains("!left-[calc(var(--sidebar-width)*-1)]")).toBe(true);
	});

	it("clears the native titlebar in the mobile sidebar header", () => {
		const content = createElement("div", null, "navigation content");
		const top = createElement("div", null, "navigation top");
		const layout = createElement(LeftNavigationLayout, {
			isCollapsed: false,
			isMobile: true,
			isVisible: true,
			leftNavigationContent: content,
			leftNavigationTop: top,
		});

		const { container } = renderWithTooltips(createElement(SidebarProvider, null, layout));
		const header = container.querySelector<HTMLElement>("[data-sidebar=header]");

		expect(header?.classList.contains("!pt-[var(--catalog-titlebar-offset,0rem)]")).toBe(true);
	});

	it("leaves the desktop sidebar header padding to the panel", () => {
		const content = createElement("div", null, "navigation content");
		const top = createElement("div", null, "navigation top");
		const layout = createElement(LeftNavigationLayout, {
			isCollapsed: false,
			isVisible: true,
			leftNavigationContent: content,
			leftNavigationTop: top,
		});

		const { container } = renderWithTooltips(createElement(SidebarProvider, null, layout));
		const header = container.querySelector<HTMLElement>("[data-sidebar=header]");

		expect(header?.classList.contains("!pt-[var(--catalog-titlebar-offset,0rem)]")).toBe(false);
	});

	it("keeps the collapsed rail on the floating panel edge", () => {
		const content = createElement("div", null, "navigation content");
		const layout = createElement(LeftNavigationLayout, {
			isCollapsed: true,
			isVisible: true,
			leftNavigationContent: content,
		});

		const { container } = renderWithTooltips(createElement(SidebarProvider, null, layout));
		const rail = container.querySelector<HTMLElement>("[data-sidebar=rail]");

		expect(rail?.style.right).toBe("5.5px");
		expect(rail?.style.top).toBe("8px");
		expect(rail?.style.bottom).toBe("8px");
		expect(rail?.style.transform).toBe("none");
	});

	it("reports the left transition from the animated sidebar element", () => {
		let isTransitionFromAnimatedElement = false;
		const onTransitionEnd = jest.fn((event: TransitionEvent<HTMLDivElement>) => {
			isTransitionFromAnimatedElement = event.target === event.currentTarget && event.propertyName === "left";
		});
		const content = createElement("div", null, "navigation content");
		const layout = createElement(LeftNavigationLayout, {
			isCollapsed: false,
			isVisible: false,
			leftNavigationContent: content,
			onTransitionEnd,
		});

		const { container } = renderWithTooltips(createElement(SidebarProvider, null, layout));
		const sidebar = container.querySelector<HTMLElement>("[data-sidebar=sidebar]")?.parentElement;
		const transitionEnd = new Event("transitionend", { bubbles: true });
		Object.defineProperty(transitionEnd, "propertyName", { value: "left" });
		if (sidebar) fireEvent(sidebar, transitionEnd);

		expect(onTransitionEnd).toHaveBeenCalledTimes(1);
		expect(isTransitionFromAnimatedElement).toBe(true);
	});

	it("renders the desktop navigation edge to edge", () => {
		const content = createElement("div", null, "navigation content");
		const bottom = createElement("div", null, "navigation bottom");
		const layout = createElement(LeftNavigationLayout, {
			isCollapsed: false,
			isVisible: true,
			leftNavigationBottom: bottom,
			leftNavigationContent: content,
		});

		const { container } = renderWithTooltips(createElement(SidebarProvider, null, layout));
		const sidebar = container.querySelector<HTMLElement>("[data-sidebar=sidebar]")?.parentElement;

		expect(sidebar?.classList.contains("h-full")).toBe(true);
		expect(
			sidebar?.classList.contains("[&>[data-sidebar=sidebar]]:!pt-[var(--catalog-titlebar-offset,0rem)]"),
		).toBe(true);
		expect(sidebar?.classList.contains("p-[var(--viewport-padding)]")).toBe(false);
		expect(sidebar?.classList.contains("[&>[data-sidebar=sidebar]]:!rounded-none")).toBe(true);
		expect(sidebar?.classList.contains("[&>[data-sidebar=sidebar]]:!shadow-none")).toBe(true);
		expect(sidebar?.classList.contains("[&_[data-sidebar=sidebar]]:!rounded-none")).toBe(false);
		const bottomScrollSpace = container.querySelector<HTMLElement>(
			'[data-testid="left-navigation-bottom-scroll-space"]',
		);
		expect(bottomScrollSpace?.classList.contains("h-[4.375rem]")).toBe(true);
	});

	it("places the resize handle on the navigation edge", () => {
		const content = createElement("div", null, "navigation content");
		const layout = createElement(LeftNavigationLayout, {
			isCollapsed: false,
			isVisible: true,
			leftNavigationContent: content,
		});

		const { container } = renderWithTooltips(createElement(SidebarProvider, null, layout));
		const resizeHandle = container.querySelector<HTMLElement>(".group.flex.items-center.justify-center");

		expect(resizeHandle?.style.right).toBe("0px");
		expect(resizeHandle?.closest<HTMLElement>("[style*='position: fixed']")?.style.top).toBe("0px");
	});

	it("keeps navigation hover stable while resizing", () => {
		const content = createElement("div", null, "navigation content");
		const layout = createElement(LeftNavigationLayout, {
			isCollapsed: false,
			isVisible: true,
			leftNavigationContent: content,
		});

		const { container } = renderWithTooltips(createElement(SidebarProvider, null, layout));
		const resizeHandle = container.querySelector<HTMLElement>(".group.flex.items-center.justify-center");

		expect(resizeHandle).not.toBeNull();
		fireEvent.pointerEnter(resizeHandle!);
		expect(navigationTreeStore.getState().hoveredNavigationId).toBe("sidebar");

		fireEvent.mouseDown(resizeHandle!);
		fireEvent.pointerLeave(resizeHandle!);

		expect(navigationTreeStore.getState().hoveredNavigationId).toBe("sidebar");

		fireEvent.mouseUp(window);
		fireEvent.pointerLeave(resizeHandle!);
		expect(navigationTreeStore.getState().hoveredNavigationId).toBeNull();
	});

	it("keeps the desktop resizer mounted when the navigation collapses", () => {
		const content = createElement("div", null, "navigation content");
		const renderLayout = (isCollapsed: boolean) =>
			createElement(
				SidebarProvider,
				null,
				createElement(LeftNavigationLayout, {
					isCollapsed,
					isVisible: true,
					leftNavigationContent: content,
				}),
			);

		const { container, rerender } = renderWithTooltips(renderLayout(false));
		const resizeHandle = container.querySelector<HTMLElement>(".group.flex.items-center.justify-center");
		const resizer = resizeHandle?.closest<HTMLElement>("[style*='position: fixed']");
		expect(resizer).not.toBeNull();

		rerender(renderLayout(true));

		expect(resizer?.isConnected).toBe(true);
		expect(container.querySelector(".group.flex.items-center.justify-center")).toBeNull();
	});

	it("restores the default navigation width on resize handle double click", () => {
		useSidebarsWidthStore.setState({ leftWidth: 420 });
		const content = createElement("div", null, "navigation content");
		const layout = createElement(LeftNavigationLayout, {
			isCollapsed: false,
			isVisible: true,
			leftNavigationContent: content,
		});

		const { container } = renderWithTooltips(createElement(SidebarProvider, null, layout));
		const resizeHandle = container.querySelector<HTMLElement>(".group.flex.items-center.justify-center");

		expect(resizeHandle).not.toBeNull();
		fireEvent.doubleClick(resizeHandle!);

		expect(useSidebarsWidthStore.getState().leftWidth).toBe(LEFT_NAV_DEFAULT_WIDTH);
	});

	it.each([
		{ moves: [340, 400, 360], finalWidth: 360 },
		{ moves: [100, 0], finalWidth: LEFT_NAV_MIN_WIDTH },
		{ moves: [700, 900], finalWidth: LEFT_NAV_MAX_WIDTH },
	])("previews widths $moves locally and commits only on release", ({ moves, finalWidth }) => {
		jest.useFakeTimers();
		useSidebarsWidthStore.setState({ leftWidth: 300 });
		const sidebarRef = createRef<HTMLDivElement>();
		const { container, getByText, unmount } = renderWithTooltips(
			createElement(
				SidebarProvider,
				{ open: false, style: { "--sidebar-width": "var(--left-nav-width)" } as CSSProperties },
				createElement(LeftNavigationLayout, {
					isCollapsed: false,
					isVisible: true,
					leftNavigationContent: createElement("div", null, "navigation content"),
					leftNavigationBottom: createElement("div", null, "navigation bottom"),
					sidebarRef,
				}),
			),
		);
		const handle = container.querySelector<HTMLElement>(".group.flex.items-center.justify-center")!;
		const resizer = handle.closest<HTMLElement>("[style*='position: fixed']")!;
		// JSDOM has no layout; let the real resizer measure its rendered width.
		Object.defineProperty(resizer, "offsetWidth", { get: () => Number.parseFloat(resizer.style.width) });
		const rootWidth = () => document.documentElement.style.getPropertyValue("--left-nav-width");
		const widthChanges: number[] = [];
		const unsubscribe = useSidebarsWidthStore.subscribe((state) => widthChanges.push(state.leftWidth));
		try {
			fireEvent.mouseDown(handle, { clientX: 300 });
			for (const clientX of moves) {
				const width = Math.min(LEFT_NAV_MAX_WIDTH, Math.max(LEFT_NAV_MIN_WIDTH, clientX));
				fireEvent.mouseMove(window, { clientX });
				act(() => jest.advanceTimersByTime(32));
				expect(resizer.style.width).toBe(`${width}px`);
				expect(rootWidth()).toBe("300px");
				expect(useSidebarsWidthStore.getState().leftWidth).toBe(300);
				expect(sidebarRef.current?.style.getPropertyValue("--sidebar-width")).toBe(`${width}px`);
				expect(getByText("navigation bottom").parentElement?.style.getPropertyValue("--sidebar-width")).toBe(
					`${width}px`,
				);
			}
			expect(widthChanges).toEqual([]);
			fireEvent.mouseUp(window);
			act(() => jest.advanceTimersByTime(32));
			expect(rootWidth()).toBe(`${finalWidth}px`);
			expect(widthChanges).toEqual([finalWidth]);
			fireEvent.doubleClick(handle);
			act(() => jest.advanceTimersByTime(32));
			expect(rootWidth()).toBe(`${LEFT_NAV_DEFAULT_WIDTH}px`);
			expect(sidebarRef.current?.style.getPropertyValue("--sidebar-width")).toBe(`${LEFT_NAV_DEFAULT_WIDTH}px`);
		} finally {
			unsubscribe();
			fireEvent.mouseUp(window);
			unmount();
			jest.useRealTimers();
		}
	});

	it("keeps viewport padding between the collapsed navigation and its toolbars", () => {
		const content = createElement("div", null, "navigation content");
		const bottom = createElement("div", null, "navigation bottom");
		const layout = createElement(LeftNavigationLayout, {
			isCollapsed: true,
			isVisible: true,
			leftNavigationBottom: bottom,
			leftNavigationContent: content,
		});

		const { container } = renderWithTooltips(createElement(SidebarProvider, null, layout));
		const sidebar = container.querySelector<HTMLElement>("[data-sidebar=sidebar]")?.parentElement;

		expect(sidebar?.classList.contains("!top-[var(--catalog-titlebar-offset,0rem)]")).toBe(true);
		expect(sidebar?.style.marginTop).toBe("48px");
		expect(sidebar?.style.bottom).toBe("48px");
		expect(sidebar?.style.height).toBe("auto");
		expect(sidebar?.style.padding).toBe("8px");
		expect(sidebar?.style.getPropertyValue("--viewport-padding")).toBe("");
		expect(sidebar?.classList.contains("[&>[data-sidebar=sidebar]]:!rounded-xl")).toBe(true);
		expect(sidebar?.classList.contains("[&>[data-sidebar=sidebar]]:!shadow-glass-lg")).toBe(true);
		expect(sidebar?.classList.contains("[&_[data-sidebar=sidebar]]:!rounded-xl")).toBe(false);
	});

	it("does not reserve bottom toolbar space when the collapsed navigation has no bottom controls", () => {
		const content = createElement("div", null, "navigation content");
		const layout = createElement(LeftNavigationLayout, {
			isCollapsed: true,
			isVisible: true,
			leftNavigationContent: content,
		});

		const { container } = renderWithTooltips(createElement(SidebarProvider, null, layout));
		const sidebar = container.querySelector<HTMLElement>("[data-sidebar=sidebar]")?.parentElement;

		expect(sidebar?.style.bottom).toBe("0px");
	});
});
