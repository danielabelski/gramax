import { render, screen } from "@testing-library/react";
import { type ComponentProps, createElement } from "react";
import { useFloatingPanelStore } from "../../store/useFloatingPanelStore";
import { SideZoneStack } from "./SideZoneStack";

describe("SideZoneStack", () => {
	beforeEach(() => {
		useFloatingPanelStore.setState(useFloatingPanelStore.getInitialState(), true);
	});

	it("does not reserve dock width when dock zones are unavailable", () => {
		const props: ComponentProps<typeof SideZoneStack> = {
			side: "right",
			children: createElement("button", { type: "button" }, "action"),
			reserveWidth: false,
		};
		render(createElement(SideZoneStack, props));

		const stack = screen.getByRole("button", { name: "action" }).closest("[data-side-zone-stack]");
		expect(stack?.getAttribute("style") ?? "").not.toContain("width");
	});

	it("keeps interactive children above article content without blocking empty space", () => {
		const props: ComponentProps<typeof SideZoneStack> = {
			side: "right",
			children: createElement("button", { type: "button" }, "action"),
		};
		render(createElement(SideZoneStack, props));

		const button = screen.getByRole("button", { name: "action" });
		const stack = button.closest("[data-side-zone-stack]");
		expect(stack?.classList.contains("z-[var(--z-index-toolbar)]")).toBe(true);
		expect(stack?.classList.contains("pointer-events-none")).toBe(true);
		expect(stack?.classList.contains("inset-y-0")).toBe(true);
		expect(button.parentElement?.classList.contains("pointer-events-none")).toBe(true);
	});

	it("uses the available width before an oversized persisted width is corrected", () => {
		useFloatingPanelStore.getState().setSideZoneWidth("right", 1000);
		const props: ComponentProps<typeof SideZoneStack> = {
			side: "right",
			children: createElement("button", { type: "button" }, "action"),
			maxWidth: 900,
		};
		render(createElement(SideZoneStack, props));

		const stack = screen.getByRole("button", { name: "action" }).closest<HTMLElement>("[data-side-zone-stack]");
		expect(stack?.style.width).toBe("900px");
	});
});
