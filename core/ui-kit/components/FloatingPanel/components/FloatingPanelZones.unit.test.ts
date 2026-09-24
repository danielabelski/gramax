import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@ui-kit/Tooltip";
import { type ComponentProps, createElement } from "react";
import { useFloatingPanelStore } from "../store/useFloatingPanelStore";
import { FloatingPanelZones } from "./FloatingPanelZones";

const renderFloatingPanelZones = (props: ComponentProps<typeof FloatingPanelZones>) =>
	render(createElement(TooltipProvider, null, createElement(FloatingPanelZones, props)));

describe("FloatingPanelZones", () => {
	beforeEach(() => {
		localStorage.clear();
		useFloatingPanelStore.setState(useFloatingPanelStore.getInitialState(), true);
		useFloatingPanelStore.getState().registerPanel({ id: "agent", title: "AI agent" });
	});

	it("renders floating windows outside the catalog stacking context", () => {
		useFloatingPanelStore.getState().setIsOpen("agent", true);
		const props: ComponentProps<typeof FloatingPanelZones> = {
			children: createElement("article", null, "Article"),
		};
		const { container } = renderFloatingPanelZones(props);

		const panel = screen.getByRole("dialog", { name: "AI agent" });
		expect(document.body.contains(panel)).toBe(true);
		expect(container.contains(panel)).toBe(false);
		expect(container.contains(screen.getByRole("article"))).toBe(true);
	});

	it("keeps the content right inset at zero without the right-navigation underlay", () => {
		useFloatingPanelStore.getState().setIsOpen("agent", true);
		useFloatingPanelStore.getState().dockPanel("agent", "right");
		useFloatingPanelStore.getState().setSideZoneWidth("right", 400);
		const props: ComponentProps<typeof FloatingPanelZones> = {
			rightDockedZoneClassName: "block",
			children: createElement("article", null, "Article"),
		};

		renderFloatingPanelZones(props);

		expect(screen.getByRole("article").parentElement?.style.getPropertyValue("--right-zone-underlay-width")).toBe(
			"0px",
		);
	});

	it("uses the configured content inset without constraining the underlay", () => {
		useFloatingPanelStore.getState().setSideZoneWidth("right", 400);
		const props: ComponentProps<typeof FloatingPanelZones> = {
			reserveRightUnderlay: true,
			rightZoneUnderlay: createElement("nav", null, "Right navigation"),
			rightZoneUnderlayWidth: 240,
			children: createElement("article", null, "Article"),
		};

		renderFloatingPanelZones(props);

		expect(screen.getByRole("article").parentElement?.style.getPropertyValue("--right-zone-underlay-width")).toBe(
			"240px",
		);
		expect(
			screen.getByRole("navigation").closest<HTMLElement>('[data-floating-panel-underlay="right"]')?.style.width,
		).toBe("");
	});

	it("accepts a CSS-resolved content inset", () => {
		const props: ComponentProps<typeof FloatingPanelZones> = {
			reserveRightUnderlay: true,
			rightZoneUnderlayWidth: "var(--responsive-underlay-width)",
			children: createElement("article", null, "Article"),
		};

		renderFloatingPanelZones(props);

		expect(screen.getByRole("article").parentElement?.style.getPropertyValue("--right-zone-underlay-width")).toBe(
			"var(--responsive-underlay-width)",
		);
	});

	it("keeps the underlay width when an open docked panel is wider", () => {
		useFloatingPanelStore.getState().setIsOpen("agent", true);
		useFloatingPanelStore.getState().dockPanel("agent", "right");
		useFloatingPanelStore.getState().setSideZoneWidth("right", 400);
		const props: ComponentProps<typeof FloatingPanelZones> = {
			rightDockedZoneClassName: "block",
			reserveRightUnderlay: true,
			rightZoneUnderlayWidth: 240,
			children: createElement("article", null, "Article"),
		};

		renderFloatingPanelZones(props);

		expect(screen.getByRole("article").parentElement?.style.getPropertyValue("--right-zone-underlay-width")).toBe(
			"240px",
		);
	});

	it("uses the configured vertical inset for the right dock zone", () => {
		const props = {
			rightDockedZoneClassName: "block",
			rightDockedZoneInset: 56,
			children: createElement("article", null, "Article"),
		} as ComponentProps<typeof FloatingPanelZones> & { rightDockedZoneInset: number };

		const { container } = renderFloatingPanelZones(props);
		const dockZone = container.querySelector<HTMLElement>('[data-side-zone-stack="right"] > div > div');

		expect(dockZone?.style.top).toBe("56px");
		expect(dockZone?.style.bottom).toBe("56px");
	});

	it("keeps the right-navigation underlay below floating panels", () => {
		const props: ComponentProps<typeof FloatingPanelZones> = {
			children: createElement("article", null, "Article"),
			rightZoneUnderlay: createElement("nav", null, "Right navigation"),
		};

		renderFloatingPanelZones(props);

		const underlay = screen.getByRole("navigation").closest('[data-floating-panel-underlay="right"]');
		expect(underlay).not.toBeNull();
		expect(underlay?.closest('[data-side-zone-stack="right"]')).toBeNull();
	});

	it("enables docking only when the responsive dock zone has a visible box", () => {
		const getBoundingClientRect = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
			width: 292,
			height: 600,
		} as DOMRect);
		const props: ComponentProps<typeof FloatingPanelZones> = {
			rightDockedZoneClassName: "block",
			children: createElement("article", null, "Article"),
		};

		renderFloatingPanelZones(props);

		expect(useFloatingPanelStore.getState().isRightDockZoneAvailable).toBe(true);
		getBoundingClientRect.mockRestore();
	});

	it("publishes the real bounds when an open right dock zone exists", () => {
		const getBoundingClientRect = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
			left: 908,
			right: 1200,
			top: 60,
			bottom: 740,
			width: 292,
			height: 680,
		} as DOMRect);
		useFloatingPanelStore.getState().setRightDockZoneAvailability(true, { width: 1200, height: 800 });
		useFloatingPanelStore.getState().setIsOpen("agent", true);
		useFloatingPanelStore.getState().dockPanel("agent", "right");
		const props: ComponentProps<typeof FloatingPanelZones> = {
			rightDockedZoneClassName: "block",
			children: createElement("article", null, "Article"),
		};

		renderFloatingPanelZones(props);

		expect(useFloatingPanelStore.getState().rightDockZoneBounds).toEqual({
			left: 908,
			right: 1200,
			top: 60,
			bottom: 740,
		});
		getBoundingClientRect.mockRestore();
	});
});
