import {
	LEFT_NAV_DEFAULT_WIDTH,
	LEFT_NAV_MAX_WIDTH,
	LEFT_NAV_MIN_WIDTH,
} from "@ext/navigation/catalog/SidebarNavigation/utils/constants";
import { useSidebarsWidthStore } from "./SidebarsWidthStore";

describe("useSidebarsWidthStore", () => {
	beforeEach(() => {
		localStorage.clear();
		useSidebarsWidthStore.setState({ leftWidth: LEFT_NAV_DEFAULT_WIDTH });
	});

	it("updates the left width", () => {
		useSidebarsWidthStore.getState().setLeftWidth(320);
		expect(useSidebarsWidthStore.getState().leftWidth).toBe(320);
	});

	it("clamps the left width to the allowed range", () => {
		useSidebarsWidthStore.getState().setLeftWidth(LEFT_NAV_MIN_WIDTH - 100);
		expect(useSidebarsWidthStore.getState().leftWidth).toBe(LEFT_NAV_MIN_WIDTH);

		useSidebarsWidthStore.getState().setLeftWidth(LEFT_NAV_MAX_WIDTH + 100);
		expect(useSidebarsWidthStore.getState().leftWidth).toBe(LEFT_NAV_MAX_WIDTH);
	});

	it("persists only the left width", () => {
		useSidebarsWidthStore.getState().setLeftWidth(320);

		expect(JSON.parse(localStorage.getItem("SidebarsWidth"))).toEqual({
			state: { leftWidth: 320 },
			version: 0,
		});
	});
});
