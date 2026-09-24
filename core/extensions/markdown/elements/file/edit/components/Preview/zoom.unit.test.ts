import { getNextZoom, ZOOM_LEVELS } from "./zoom";

describe("file preview zoom", () => {
	it("uses Chrome zoom levels from 25% to 500%", () => {
		expect(ZOOM_LEVELS).toEqual([0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5]);
	});

	it("moves to adjacent levels around 100%", () => {
		expect(getNextZoom(1, -1)).toBe(0.9);
		expect(getNextZoom(1, 1)).toBe(1.1);
	});

	it("stops at the minimum and maximum levels", () => {
		expect(getNextZoom(0.25, -1)).toBe(0.25);
		expect(getNextZoom(5, 1)).toBe(5);
	});
});
