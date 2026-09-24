import { getResizedPanelPosition } from "./getResizedPanelPosition";

describe("getResizedPanelPosition", () => {
	beforeEach(() => {
		Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
		Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
	});

	it("moves the origin by the resize delta for top-left resizing", () => {
		expect(
			getResizedPanelPosition({
				start: { x: 300, y: 200 },
				direction: "topLeft",
				delta: { width: 40, height: 30 },
				panelSize: { width: 320, height: 480 },
			}),
		).toEqual({ x: 260, y: 170 });
	});

	it("keeps the origin for bottom-right resizing", () => {
		expect(
			getResizedPanelPosition({
				start: { x: 300, y: 200 },
				direction: "bottomRight",
				delta: { width: 40, height: 30 },
				panelSize: { width: 320, height: 480 },
			}),
		).toEqual({ x: 300, y: 200 });
	});

	it("returns null when resizing starts without a panel position", () => {
		expect(
			getResizedPanelPosition({
				start: null,
				direction: "left",
				delta: { width: 40, height: 0 },
				panelSize: { width: 320, height: 480 },
			}),
		).toBeNull();
	});
});
