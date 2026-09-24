import { clampPositionIntoViewport } from "./clampPositionIntoViewport";

describe("clampPositionIntoViewport", () => {
	it("keeps the whole panel inside the viewport", () => {
		expect(
			clampPositionIntoViewport({ x: 900, y: 700 }, { width: 320, height: 480 }, { width: 800, height: 600 }),
		).toEqual({ x: 480, y: 120 });
	});

	it("pins a panel larger than the viewport to its top left corner", () => {
		expect(
			clampPositionIntoViewport({ x: 900, y: 700 }, { width: 1000, height: 900 }, { width: 800, height: 600 }),
		).toEqual({ x: 0, y: 0 });
	});

	it("does not move a panel that already fits", () => {
		expect(
			clampPositionIntoViewport({ x: 100, y: 50 }, { width: 320, height: 480 }, { width: 800, height: 600 }),
		).toEqual({ x: 100, y: 50 });
	});
});
