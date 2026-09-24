import { MAX_PANEL_Z_INDEX, PANEL_DEFAULT_HEIGHT, PANEL_DEFAULT_WIDTH } from "../constants";
import { useFloatingPanelStore } from "./useFloatingPanelStore";

describe("useFloatingPanelStore z-index ordering", () => {
	beforeEach(() => {
		localStorage.clear();
		useFloatingPanelStore.setState(useFloatingPanelStore.getInitialState(), true);
		useFloatingPanelStore.getState().registerPanel({ id: "first", title: "First" });
		useFloatingPanelStore.getState().registerPanel({ id: "second", title: "Second" });
	});

	it("brings a panel to the bounded top layer without collapsing the other layers", () => {
		useFloatingPanelStore.getState().bringToFront("first");

		const { panels } = useFloatingPanelStore.getState();
		expect(panels.first.zIndex).toBe(MAX_PANEL_Z_INDEX);
		expect(panels.second.zIndex).toBe(MAX_PANEL_Z_INDEX - 1);
	});

	it("does not register an unknown panel while bringing it to front", () => {
		useFloatingPanelStore.getState().bringToFront("missing");

		expect(useFloatingPanelStore.getState().panels).not.toHaveProperty("missing");
	});

	it("moves a panel above the sidebar when it opens", () => {
		useFloatingPanelStore.getState().setIsOpen("first", true);

		expect(useFloatingPanelStore.getState().panels.first.zIndex).toBe(MAX_PANEL_Z_INDEX);
	});

	it("does not persist a panel that was only opened", () => {
		useFloatingPanelStore.getState().setIsOpen("first", true);

		const persisted = JSON.parse(localStorage.getItem("floating-panel-state") ?? "null");
		expect(persisted.state.panels).not.toHaveProperty("first");
	});

	it("persists a panel after it is docked on the right", () => {
		useFloatingPanelStore.getState().setRightDockZoneAvailability(true, { width: 1200, height: 800 });
		useFloatingPanelStore.getState().dockPanel("first", "right");

		const persisted = JSON.parse(localStorage.getItem("floating-panel-state") ?? "null");
		expect(persisted.state.panels.first).toMatchObject({ dockedSide: "right" });
	});

	it("persists and restores a panel that was resized before it was moved", async () => {
		useFloatingPanelStore.getState().setSizeAndPosition("first", { width: 400, height: 560 }, { x: 100, y: 120 });
		const persisted = localStorage.getItem("floating-panel-state");

		expect(JSON.parse(persisted ?? "null").state.panels.first).toMatchObject({
			isUserPositioned: true,
			position: { x: 100, y: 120 },
			size: { width: 400, height: 560 },
		});

		useFloatingPanelStore.setState(useFloatingPanelStore.getInitialState(), true);
		localStorage.setItem("floating-panel-state", persisted ?? "");
		await useFloatingPanelStore.persist.rehydrate();
		useFloatingPanelStore.getState().registerPanel({ id: "first", title: "First" });

		expect(useFloatingPanelStore.getState().panels.first).toMatchObject({
			isUserPositioned: true,
			position: { x: 100, y: 120 },
			size: { width: 400, height: 560 },
		});
	});

	it("does not update the store for an unchanged transient placement", () => {
		const position = { x: 100, y: 120 };
		useFloatingPanelStore.getState().setTransientPosition("first", position, "top-left");
		const panel = useFloatingPanelStore.getState().panels.first;

		useFloatingPanelStore.getState().setTransientPosition("first", { ...position }, "top-left");

		expect(useFloatingPanelStore.getState().panels.first).toBe(panel);
	});

	it("resets the panel size and enables automatic positioning", () => {
		useFloatingPanelStore.getState().setPosition("first", { x: 100, y: 120 });
		useFloatingPanelStore.getState().setSizeAndPosition("first", { width: 640, height: 720 }, { x: 200, y: 240 });

		useFloatingPanelStore.getState().resetSizeAndPosition("first");

		expect(useFloatingPanelStore.getState().panels.first).toMatchObject({
			isUserPositioned: false,
			size: { width: PANEL_DEFAULT_WIDTH, height: PANEL_DEFAULT_HEIGHT },
		});
	});

	it("undocks and clamps a panel when the right dock zone becomes unavailable", () => {
		useFloatingPanelStore.getState().setIsOpen("first", true);
		useFloatingPanelStore.getState().setPosition("first", { x: 900, y: 700 });
		useFloatingPanelStore.getState().setRightDockZoneAvailability(true, { width: 1200, height: 800 });
		useFloatingPanelStore.getState().dockPanel("first", "right");

		useFloatingPanelStore.getState().setRightDockZoneAvailability(false, { width: 800, height: 600 });

		expect(useFloatingPanelStore.getState().panels.first).toMatchObject({
			dockedSide: null,
			position: { x: 480, y: 120 },
		});
	});

	it("clamps open floating panels when the viewport changes", () => {
		useFloatingPanelStore.getState().setIsOpen("first", true);
		useFloatingPanelStore.getState().setPosition("first", { x: 900, y: 700 });

		useFloatingPanelStore.getState().clampPositions({ width: 800, height: 600 });

		expect(useFloatingPanelStore.getState().panels.first.position).toEqual({ x: 480, y: 120 });
	});

	it("restores the preferred panel position when the viewport grows after clamping", () => {
		useFloatingPanelStore.getState().setIsOpen("first", true);
		useFloatingPanelStore.getState().setPosition("first", { x: 900, y: 700 });

		useFloatingPanelStore.getState().clampPositions({ width: 300, height: 200 });
		expect(useFloatingPanelStore.getState().panels.first.position).toEqual({ x: 0, y: 0 });

		useFloatingPanelStore.getState().clampPositions({ width: 1400, height: 1200 });

		expect(useFloatingPanelStore.getState().panels.first.position).toEqual({ x: 900, y: 700 });
	});

	it("does not move docked, maximized, or closed panels when the viewport changes", () => {
		useFloatingPanelStore.setState((state) => ({
			panels: {
				...state.panels,
				first: {
					...state.panels.first,
					isOpen: true,
					dockedSide: "right",
					position: { x: 900, y: 700 },
				},
				second: {
					...state.panels.second,
					isOpen: true,
					isMaximized: true,
					position: { x: 900, y: 700 },
				},
			},
		}));
		useFloatingPanelStore.getState().registerPanel({ id: "closed", title: "Closed" });
		useFloatingPanelStore.getState().setPosition("closed", { x: 900, y: 700 });

		useFloatingPanelStore.getState().clampPositions({ width: 800, height: 600 });

		expect(useFloatingPanelStore.getState().panels.first.position).toEqual({ x: 900, y: 700 });
		expect(useFloatingPanelStore.getState().panels.second.position).toEqual({ x: 900, y: 700 });
		expect(useFloatingPanelStore.getState().panels.closed.position).toEqual({ x: 900, y: 700 });
	});
});
