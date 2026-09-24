import { useSidebarsPinStore } from "@core-ui/ContextServices/Sidebars/SidebarsPinStore";
import { fireEvent, render } from "@testing-library/react";
import { SidebarProvider, useSidebar } from "@ui-kit/Sidebar";
import { TooltipProvider } from "@ui-kit/Tooltip";
import { act, createElement, type ReactElement } from "react";
import LeftNavigationComponent from "./LeftNavigationComponent";

type MutableMediaQueryList = Omit<MediaQueryList, "matches"> & { matches: boolean };

const mediaQueryLists = new Map<string, MutableMediaQueryList>();
let initialLgMatches = true;
let mockCanSeeNavigationBottom = false;
let mockLeftNavContentRenderCount = 0;
const mockItemLinks: never[] = [];
let mockPath = "/catalog/a";

const setMediaQueryMatches = (query: string, matches: boolean) => {
	const mediaQueryList = mediaQueryLists.get(query);
	if (!mediaQueryList) throw new Error(`Media query was not registered: ${query}`);

	mediaQueryList.matches = matches;
	mediaQueryList.dispatchEvent(new Event("change"));
};

jest.mock("@core/Api/useRouter", () => ({
	useRouter: () => ({ path: mockPath }),
}));

jest.mock("@components/ArticlePage/Bars/TopBarContentMobile", () => ({
	TopBarContentMobile: () => null,
}));

jest.mock("@core-ui/ContextServices/views/leftNavView/LeftNavViewContentService", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest uses this marker to preserve the default export shape
	__esModule: true,
	default: {
		value: () => {
			mockLeftNavContentRenderCount += 1;
			return null;
		},
	},
}));

jest.mock("@core-ui/stores/EditorStore", () => ({
	getEditorStore: () => ({ editor: undefined }),
}));

jest.mock("@core-ui/stores/ItemLinksStore/ItemLinksStore.provider", () => ({
	useItemLinks: () => mockItemLinks,
}));

jest.mock("@core-ui/utils/stopOpeningPanels ", () => () => undefined);
jest.mock("../useCanSeeNavigationBottom", () => ({
	useCanSeeNavigationBottom: () => mockCanSeeNavigationBottom,
}));
jest.mock("../MobileNavigationBottom", () => () => null);
jest.mock("./CollapsedNavigationToolbar", () => ({
	CollapsedNavigationToolbar: () => "collapsed navigation toolbar",
}));
jest.mock("./LeftNavigationBottom", () => () => null);
jest.mock("./LeftNavigationTop", () => () => null);
jest.mock("./MobileNavigationHeader", () => ({ MobileNavigationHeader: () => null }));

// ics-ui-kit 0.1.15 dropped the TooltipProvider that SidebarProvider used to render for the collapsed trigger.
const renderWithTooltips = (ui: ReactElement) => render(ui, { wrapper: TooltipProvider });

const dispatchLeftTransitionEnd = (element: HTMLElement) => {
	const event = new Event("transitionend", { bubbles: true });
	Object.defineProperty(event, "propertyName", { value: "left" });
	fireEvent(element, event);
};

describe("LeftNavigationComponent", () => {
	beforeEach(() => {
		useSidebarsPinStore.setState({ isLeftPinned: true });
		mediaQueryLists.clear();
		initialLgMatches = true;
		mockCanSeeNavigationBottom = false;
		mockLeftNavContentRenderCount = 0;
		mockPath = "/catalog/a";
		jest.spyOn(window, "matchMedia").mockImplementation((query) => {
			const existingMediaQueryList = mediaQueryLists.get(query);
			if (existingMediaQueryList) return existingMediaQueryList;

			const eventTarget = new EventTarget();
			const mediaQueryList: MutableMediaQueryList = {
				matches: query === "(min-width: 1024px)" && initialLgMatches,
				media: query,
				onchange: null,
				addEventListener: eventTarget.addEventListener.bind(eventTarget),
				removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
				addListener: (listener) => eventTarget.addEventListener("change", listener),
				removeListener: (listener) => eventTarget.removeEventListener("change", listener),
				dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
			};
			mediaQueryLists.set(query, mediaQueryList);
			return mediaQueryList;
		});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("keeps only a small gap when the bottom navigation is unavailable", () => {
		const { container } = renderWithTooltips(
			createElement(SidebarProvider, null, createElement(LeftNavigationComponent)),
		);
		const bottomScrollSpace = container.querySelector<HTMLElement>(
			'[data-testid="left-navigation-bottom-scroll-space"]',
		);

		expect(bottomScrollSpace?.classList.contains("h-2")).toBe(true);
		expect(bottomScrollSpace?.classList.contains("h-[4.375rem]")).toBe(false);
	});

	it("ignores hover collected while the sidebar is leaving", () => {
		const { container } = renderWithTooltips(
			createElement(SidebarProvider, null, createElement(LeftNavigationComponent)),
		);
		const sidebar = container.querySelector<HTMLElement>("[data-sidebar=sidebar]")?.parentElement;
		if (!sidebar) throw new Error("Sidebar was not rendered");

		void act(() => useSidebarsPinStore.setState({ isLeftPinned: false }));
		expect(container.textContent).toContain("collapsed navigation toolbar");
		fireEvent.mouseOver(sidebar);
		dispatchLeftTransitionEnd(sidebar);

		expect(sidebar.classList.contains("!left-[calc(var(--sidebar-width)*-1)]")).toBe(true);
		expect(sidebar.classList.contains("!left-0")).toBe(false);

		const sidebarTrigger = container.querySelector<HTMLElement>("[data-sidebar-trigger]");
		if (!sidebarTrigger) throw new Error("Sidebar trigger was not rendered");
		fireEvent.mouseOver(sidebarTrigger);

		expect(sidebar.classList.contains("!left-0")).toBe(true);
	});

	it("keeps the collapsed presentation when returning from mobile", () => {
		useSidebarsPinStore.setState({ isLeftPinned: false });
		initialLgMatches = false;
		const { container } = renderWithTooltips(
			createElement(SidebarProvider, null, createElement(LeftNavigationComponent)),
		);

		void act(() => setMediaQueryMatches("(min-width: 1024px)", true));

		expect(container.querySelector("[data-sidebar-trigger]")).not.toBeNull();
	});

	it("does not rerender navigation content while changing its docked presentation", () => {
		const { container } = renderWithTooltips(
			createElement(SidebarProvider, null, createElement(LeftNavigationComponent)),
		);
		const sidebar = container.querySelector<HTMLElement>("[data-sidebar=sidebar]")?.parentElement;
		if (!sidebar) throw new Error("Sidebar was not rendered");

		expect(mockLeftNavContentRenderCount).toBe(1);

		void act(() => useSidebarsPinStore.setState({ isLeftPinned: false }));
		dispatchLeftTransitionEnd(sidebar);
		void act(() => useSidebarsPinStore.setState({ isLeftPinned: true }));

		expect(mockLeftNavContentRenderCount).toBe(1);
	});
	it("closes the mobile sheet when the route changes, and only then", () => {
		initialLgMatches = false;
		let sidebar: ReturnType<typeof useSidebar> | null = null;
		const SidebarProbe = () => {
			sidebar = useSidebar();
			return null;
		};
		const tree = () =>
			createElement(SidebarProvider, null, createElement(LeftNavigationComponent), createElement(SidebarProbe));
		const { rerender } = renderWithTooltips(tree());
		if (!sidebar) throw new Error("Sidebar context was not rendered");

		void act(() => sidebar?.setOpenMobile(true));
		rerender(tree());
		expect(sidebar.openMobile).toBe(true);

		mockPath = "/catalog/b";
		rerender(tree());
		expect(sidebar.openMobile).toBe(false);
	});
});
