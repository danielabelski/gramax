import { getFloatingPanelAnimationClassName } from "./getFloatingPanelAnimationClassName";

describe("getFloatingPanelAnimationClassName", () => {
	it("matches the dropdown entrance from the left", () => {
		expect(getFloatingPanelAnimationClassName("open", "bottom-left")).toBe(
			"animate-in fade-in-0 zoom-in-95 slide-in-from-left-2",
		);
	});

	it("matches the dropdown entrance from the right", () => {
		expect(getFloatingPanelAnimationClassName("open", "bottom-right")).toBe(
			"animate-in fade-in-0 zoom-in-95 slide-in-from-right-2",
		);
	});

	it("matches the dropdown exit", () => {
		expect(getFloatingPanelAnimationClassName("closed", "bottom-left")).toBe(
			"pointer-events-none animate-out fade-out-0 zoom-out-95 [animation-fill-mode:forwards]",
		);
	});
});
