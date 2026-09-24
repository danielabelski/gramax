import { useSidebarsWidthStore } from "@core-ui/ContextServices/Sidebars/SidebarsWidthStore";
import { renderHook } from "@testing-library/react";
import useLeftNavigationWidthVar from "./useLeftNavigationWidthVar";

describe("useLeftNavigationWidthVar", () => {
	beforeEach(() => {
		document.documentElement.style.removeProperty("--left-nav-width");
		useSidebarsWidthStore.setState({ leftWidth: 340 });
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("sets the initial width before the next animation frame", () => {
		const requestAnimationFrame = jest.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);

		const { unmount } = renderHook(() => useLeftNavigationWidthVar());

		expect(document.documentElement.style.getPropertyValue("--left-nav-width")).toBe("340px");
		expect(requestAnimationFrame).not.toHaveBeenCalled();

		unmount();
	});

	it("keeps the width available between catalog mounts", () => {
		const { unmount } = renderHook(() => useLeftNavigationWidthVar());

		unmount();

		expect(document.documentElement.style.getPropertyValue("--left-nav-width")).toBe("340px");
	});
});
