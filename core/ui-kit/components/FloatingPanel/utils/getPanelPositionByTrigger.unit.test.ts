import { HEADER_HEIGHT } from "../constants";
import { getPanelPositionByTrigger } from "./getPanelPositionByTrigger";

const rect = (left: number, right: number, top: number, bottom: number) => ({ left, right, top, bottom });

describe("getPanelPositionByTrigger", () => {
	it("falls back to bottom-start when top placements overflow", () => {
		expect(
			getPanelPositionByTrigger({
				trigger: rect(24, 88, 100, 140),
				panelSize: { width: 320, height: 200 },
				viewport: { width: 1200, height: 800 },
				gap: 12,
			}),
		).toEqual({ position: { x: 24, y: 152 }, animationOrigin: "top-left" });
	});

	it("prefers top-start when it fits", () => {
		expect(
			getPanelPositionByTrigger({
				trigger: rect(24, 88, 700, 740),
				panelSize: { width: 320, height: 200 },
				viewport: { width: 1200, height: 800 },
				gap: 12,
			}),
		).toEqual({ position: { x: 24, y: 488 }, animationOrigin: "bottom-left" });
	});

	it("uses bottom-end when bottom-start overflows", () => {
		expect(
			getPanelPositionByTrigger({
				trigger: rect(1100, 1160, 100, 140),
				panelSize: { width: 320, height: 200 },
				viewport: { width: 1200, height: 800 },
				gap: 12,
			}),
		).toEqual({ position: { x: 840, y: 152 }, animationOrigin: "top-right" });
	});

	it("falls back to bottom-start when horizontal sides do not fit", () => {
		expect(
			getPanelPositionByTrigger({
				trigger: rect(90, 410, 100, 140),
				panelSize: { width: 320, height: 200 },
				viewport: { width: 500, height: 800 },
				gap: 12,
			}),
		).toEqual({ position: { x: 90, y: 152 }, animationOrigin: "top-left" });
	});

	it("uses top-start when bottom placements overflow", () => {
		expect(
			getPanelPositionByTrigger({
				trigger: rect(90, 410, 700, 740),
				panelSize: { width: 320, height: 200 },
				viewport: { width: 500, height: 800 },
				gap: 12,
			}),
		).toEqual({ position: { x: 90, y: 488 }, animationOrigin: "bottom-left" });
	});

	it("opens inward from a bottom toolbar trigger", () => {
		expect(
			getPanelPositionByTrigger({
				trigger: rect(130, 546, 1030, 1110),
				panelSize: { width: 640, height: 960 },
				viewport: { width: 1390, height: 1130 },
				gap: 12,
			}),
		).toEqual({ position: { x: 130, y: 58 }, animationOrigin: "bottom-left" });
	});

	it("opens inward from a top toolbar trigger", () => {
		expect(
			getPanelPositionByTrigger({
				trigger: rect(400, 464, 12, 52),
				panelSize: { width: 320, height: 200 },
				viewport: { width: 1200, height: 800 },
				gap: 12,
			}),
		).toEqual({ position: { x: 400, y: 64 }, animationOrigin: "top-left" });
	});

	it("opens above a bottom-right toolbar trigger", () => {
		expect(
			getPanelPositionByTrigger({
				trigger: rect(1140, 1180, 730, 770),
				panelSize: { width: 320, height: 480 },
				viewport: { width: 1200, height: 800 },
				gap: 12,
			}),
		).toEqual({ position: { x: 860, y: 238 }, animationOrigin: "bottom-right" });
	});

	it("keeps the panel header below the viewport controls when every placement overflows", () => {
		expect(
			getPanelPositionByTrigger({
				trigger: rect(878, 1190, 390, 430),
				panelSize: { width: 320, height: 480 },
				viewport: { width: 1280, height: 720 },
				gap: 12,
			}),
		).toMatchObject({ position: { y: HEADER_HEIGHT } });
	});

	it("keeps an oversized panel below the viewport controls", () => {
		expect(
			getPanelPositionByTrigger({
				trigger: rect(100, 140, 20, 60),
				panelSize: { width: 320, height: 480 },
				viewport: { width: 300, height: 400 },
				gap: 12,
			}),
		).toEqual({ position: { x: 0, y: HEADER_HEIGHT }, animationOrigin: "top-left" });
	});
});
