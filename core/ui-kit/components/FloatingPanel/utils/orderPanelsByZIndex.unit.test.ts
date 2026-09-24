import { MAX_PANEL_Z_INDEX, MAXIMIZED_PANEL_Z_INDEX } from "../constants";
import type { PanelId, PanelState } from "../types/FloatingPanelTypes";
import { orderPanelsByZIndex } from "./orderPanelsByZIndex";

const panel = (id: PanelId, zIndex: number): PanelState => ({
	id,
	title: id,
	position: null,
	preferredPosition: null,
	isUserPositioned: false,
	size: { width: 320, height: 480 },
	isOpen: true,
	zIndex,
	dockedSide: null,
	isMaximized: false,
	animationOrigin: "bottom-left",
});

const zIndexes = (panels: Record<PanelId, PanelState>) =>
	Object.fromEntries(Object.entries(panels).map(([id, state]) => [id, state.zIndex]));

describe("orderPanelsByZIndex", () => {
	it("keeps floating panels above the toolbar and maximized panels at the overlay boundary", () => {
		expect(MAX_PANEL_Z_INDEX).toBe(49);
		expect(MAXIMIZED_PANEL_Z_INDEX).toBe(50);
	});

	it("moves the selected panel to the fixed top layer and preserves the order of other panels", () => {
		const panels = {
			first: panel("first", 10),
			selected: panel("selected", 11),
			last: panel("last", 12),
		};

		expect(zIndexes(orderPanelsByZIndex(panels, "selected"))).toEqual({
			first: MAX_PANEL_Z_INDEX - 2,
			selected: MAX_PANEL_Z_INDEX,
			last: MAX_PANEL_Z_INDEX - 1,
		});
	});

	it("keeps distinct consecutive layers after repeated activation", () => {
		const panels = {
			first: panel("first", 10),
			second: panel("second", 11),
			third: panel("third", 12),
		};

		const afterFirstActivation = orderPanelsByZIndex(panels, "first");
		const afterSecondActivation = orderPanelsByZIndex(afterFirstActivation, "second");
		const afterRepeatedActivation = orderPanelsByZIndex(afterSecondActivation, "second");

		expect(zIndexes(afterRepeatedActivation)).toEqual({
			first: MAX_PANEL_Z_INDEX - 1,
			second: MAX_PANEL_Z_INDEX,
			third: MAX_PANEL_Z_INDEX - 2,
		});
	});

	it("preserves panel registration order when bringing panels to front", () => {
		const panels = {
			first: panel("first", 10),
			second: panel("second", 11),
			third: panel("third", 12),
		};

		const reordered = orderPanelsByZIndex(panels, "first");

		expect(Object.keys(reordered)).toEqual(["first", "second", "third"]);
	});

	it("normalizes inflated legacy layers below the overlay boundary", () => {
		const panels = {
			first: panel("first", 10_000),
			second: panel("second", 50_000),
		};

		expect(zIndexes(orderPanelsByZIndex(panels))).toEqual({
			first: MAX_PANEL_Z_INDEX - 1,
			second: MAX_PANEL_Z_INDEX,
		});
	});

	it("does not mutate or reorder panels for an unknown selected id", () => {
		const panels = {
			first: panel("first", 10),
			second: panel("second", 11),
		};

		expect(orderPanelsByZIndex(panels, "missing")).toBe(panels);
	});
});
