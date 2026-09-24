import { getEdgeDropSide } from "./getEdgeDropSide";

describe("getEdgeDropSide", () => {
	const viewport = { width: 1200, height: 800 };

	it("does not offer the unavailable left dock zone", () => {
		expect(getEdgeDropSide({ x: 0, y: 400 }, viewport, null)).toBeNull();
	});

	it("does not offer a new right dock zone when the grab point is more than 64px from the edge", () => {
		expect(getEdgeDropSide({ x: 1135, y: 400 }, viewport, null)).toBeNull();
	});

	it("offers a new right dock zone when the grab point reaches the 64px viewport edge", () => {
		expect(getEdgeDropSide({ x: 1136, y: 400 }, viewport, null)).toBe("right");
	});

	it("uses the real bounds when the right dock zone already exists", () => {
		const dockZoneBounds = { left: 908, right: 1200, top: 60, bottom: 740 };

		expect(getEdgeDropSide({ x: 950, y: 400 }, viewport, dockZoneBounds)).toBe("right");
		expect(getEdgeDropSide({ x: 900, y: 400 }, viewport, dockZoneBounds)).toBeNull();
		expect(getEdgeDropSide({ x: 950, y: 50 }, viewport, dockZoneBounds)).toBeNull();
	});
});
