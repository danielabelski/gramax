import { useSidebarsPinStore } from "./SidebarsPinStore";

describe("useSidebarsPinStore", () => {
	beforeEach(() => {
		localStorage.clear();
		document.documentElement.removeAttribute("data-left-sidebar-pinned");
		useSidebarsPinStore.setState({ isLeftPinned: true });
	});

	it("updates and toggles the left pin state", () => {
		useSidebarsPinStore.getState().setLeftPinned(false);
		expect(useSidebarsPinStore.getState().isLeftPinned).toBe(false);
		expect(document.documentElement.dataset.leftSidebarPinned).toBe("false");

		useSidebarsPinStore.getState().toggleLeftPinned();
		expect(useSidebarsPinStore.getState().isLeftPinned).toBe(true);
		expect(document.documentElement.dataset.leftSidebarPinned).toBe("true");
	});

	it("persists only the left pin state", () => {
		useSidebarsPinStore.getState().setLeftPinned(false);

		expect(JSON.parse(localStorage.getItem("SidebarsIsPin"))).toEqual({
			state: { isLeftPinned: false },
			version: 1,
		});
	});

	it("migrates the legacy boolean value to the Zustand format", async () => {
		localStorage.setItem("SidebarsIsPin", "false");

		await useSidebarsPinStore.persist.rehydrate();

		expect(useSidebarsPinStore.getState().isLeftPinned).toBe(false);
		expect(document.documentElement.dataset.leftSidebarPinned).toBe("false");
		expect(JSON.parse(localStorage.getItem("SidebarsIsPin"))).toEqual({
			state: { isLeftPinned: false },
			version: 1,
		});
	});
});
