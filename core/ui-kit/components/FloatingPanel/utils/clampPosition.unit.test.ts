import { clampPosition } from "./clampPosition";

describe("clampPosition", () => {
	it("clamps a panel to the provided viewport", () => {
		expect(clampPosition({ x: 900, y: 700 }, { width: 320, height: 480 }, { width: 800, height: 600 })).toEqual({
			x: 790,
			y: 120,
		});
	});

	it("keeps the whole panel inside the left and top edges", () => {
		expect(clampPosition({ x: -500, y: -100 }, { width: 320, height: 480 }, { width: 800, height: 600 })).toEqual({
			x: 0,
			y: 0,
		});
	});
});
