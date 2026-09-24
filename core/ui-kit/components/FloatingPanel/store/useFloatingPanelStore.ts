import { create } from "zustand";
import { persist } from "zustand/middleware";
import { INITIAL_Z_INDEX, PANEL_DEFAULT_HEIGHT, PANEL_DEFAULT_WIDTH, SIDE_ZONE_DEFAULT_WIDTH } from "../constants";
import type {
	DockZoneBounds,
	PanelAnimationOrigin,
	PanelDefinition,
	PanelId,
	PanelSlot,
	PanelState,
	Position,
	SideZoneSide,
	Size,
	Viewport,
} from "../types/FloatingPanelTypes";
import { clampPosition } from "../utils/clampPosition";
import { clampPositionIntoViewport } from "../utils/clampPositionIntoViewport";
import { orderPanelsByZIndex } from "../utils/orderPanelsByZIndex";

type FloatingPanelState = {
	panels: Record<PanelId, PanelState>;
	detachedPanels: Record<PanelId, PanelState>;
	slots: Record<PanelId, Partial<Record<PanelSlot, HTMLElement>>>;
	sideZoneWidths: Record<SideZoneSide, number>;
	isRightDockZoneAvailable: boolean | null;
	rightDockZoneBounds: DockZoneBounds | null;
	isResizingDockedPanels: boolean;
	registerPanel: (definition: PanelDefinition) => void;
	unregisterPanel: (id: PanelId) => void;
	setPanelSlot: (id: PanelId, slot: PanelSlot, element: HTMLElement | null) => void;
	setPosition: (id: PanelId, position: Position, animationOrigin?: PanelAnimationOrigin) => void;
	setTransientPosition: (id: PanelId, position: Position, animationOrigin?: PanelAnimationOrigin) => void;
	setSizeAndPosition: (id: PanelId, size: Size, position: Position) => void;
	resetSizeAndPosition: (id: PanelId) => void;
	setIsOpen: (id: PanelId, isOpen: boolean) => void;
	bringToFront: (id: PanelId) => void;
	setSideZoneWidth: (side: SideZoneSide, width: number) => void;
	setRightDockZoneAvailability: (isAvailable: boolean | null, viewport: Viewport) => void;
	setRightDockZoneBounds: (bounds: DockZoneBounds | null) => void;
	dockPanel: (id: PanelId, side: SideZoneSide) => void;
	undockPanel: (id: PanelId, position: Position) => void;
	setIsResizingDockedPanels: (isResizing: boolean) => void;
	clampPositions: (viewport: Viewport) => void;
	maximizePanel: (id: PanelId) => void;
	restorePanel: (id: PanelId) => void;
};

type PersistedFloatingPanelState = {
	panels: Record<PanelId, PanelState>;
	sideZoneWidths: Record<SideZoneSide, number>;
};

const createPanelState = (definition: PanelDefinition): PanelState => ({
	...definition,
	position: null,
	preferredPosition: null,
	isUserPositioned: false,
	size: { width: PANEL_DEFAULT_WIDTH, height: PANEL_DEFAULT_HEIGHT },
	isOpen: false,
	zIndex: INITIAL_Z_INDEX,
	dockedSide: null,
	isMaximized: false,
	animationOrigin: "bottom-left",
});

const clampPanelIntoViewport = (panel: PanelState, viewport: Viewport): PanelState => {
	const preferredPosition = panel.preferredPosition ?? panel.position ?? { x: 0, y: 0 };
	return {
		...panel,
		position: clampPositionIntoViewport(preferredPosition, panel.size, viewport),
		preferredPosition,
	};
};

export const useFloatingPanelStore = create<FloatingPanelState>()(
	persist(
		(set) => ({
			panels: {},
			detachedPanels: {},
			slots: {},
			sideZoneWidths: { right: SIDE_ZONE_DEFAULT_WIDTH },
			isRightDockZoneAvailable: null,
			rightDockZoneBounds: null,
			isResizingDockedPanels: false,
			registerPanel: (definition) =>
				set((state) => {
					const detachedPanel = state.detachedPanels[definition.id];
					return {
						panels: {
							...state.panels,
							[definition.id]: {
								...createPanelState(definition),
								...detachedPanel,
								...definition,
								preferredPosition: detachedPanel?.preferredPosition ?? detachedPanel?.position ?? null,
								dockedSide:
									detachedPanel?.dockedSide === "right" && state.isRightDockZoneAvailable !== false
										? "right"
										: null,
							},
						},
					};
				}),
			unregisterPanel: (id) =>
				set((state) => {
					const panel = state.panels[id];
					if (!panel) return state;
					const { [id]: _removed, ...panels } = state.panels;
					return { panels, detachedPanels: { ...state.detachedPanels, [id]: panel } };
				}),
			setPanelSlot: (id, slot, element) =>
				set((state) => {
					const panelSlots = state.slots[id] ?? {};
					if (panelSlots[slot] === element) return state;
					return { slots: { ...state.slots, [id]: { ...panelSlots, [slot]: element } } };
				}),
			setPosition: (id, position, animationOrigin) =>
				set((state) => ({
					panels: {
						...state.panels,
						[id]: {
							...state.panels[id],
							position,
							preferredPosition: position,
							isUserPositioned: true,
							animationOrigin: animationOrigin ?? state.panels[id].animationOrigin,
						},
					},
				})),
			setTransientPosition: (id, position, animationOrigin) =>
				set((state) => {
					const panel = state.panels[id];
					const nextAnimationOrigin = animationOrigin ?? panel.animationOrigin;
					if (
						panel.position?.x === position.x &&
						panel.position.y === position.y &&
						panel.preferredPosition?.x === position.x &&
						panel.preferredPosition.y === position.y &&
						panel.animationOrigin === nextAnimationOrigin
					)
						return state;
					return {
						panels: {
							...state.panels,
							[id]: {
								...panel,
								position,
								preferredPosition: position,
								animationOrigin: nextAnimationOrigin,
							},
						},
					};
				}),
			setSizeAndPosition: (id, size, position) =>
				set((state) => ({
					panels: {
						...state.panels,
						[id]: {
							...state.panels[id],
							size,
							position,
							preferredPosition: position,
							isUserPositioned: true,
						},
					},
				})),
			resetSizeAndPosition: (id) =>
				set((state) => ({
					panels: {
						...state.panels,
						[id]: {
							...state.panels[id],
							size: { width: PANEL_DEFAULT_WIDTH, height: PANEL_DEFAULT_HEIGHT },
							preferredPosition: null,
							isUserPositioned: false,
						},
					},
				})),
			setIsOpen: (id, isOpen) =>
				set((state) => {
					const panel = state.panels[id];
					if (!panel) return state;
					const preferredPosition = panel.preferredPosition ?? panel.position;
					const position =
						isOpen && !panel.dockedSide
							? clampPosition(preferredPosition ?? { x: 0, y: 0 }, panel.size)
							: panel.position;
					const panels = {
						...state.panels,
						[id]: { ...panel, isOpen, position, preferredPosition },
					};
					return {
						panels: isOpen ? orderPanelsByZIndex(panels, id) : panels,
					};
				}),
			bringToFront: (id) =>
				set((state) => {
					const panels = orderPanelsByZIndex(state.panels, id);
					return panels === state.panels ? state : { panels };
				}),
			setSideZoneWidth: (side, width) =>
				set((state) => ({
					sideZoneWidths: { ...state.sideZoneWidths, [side]: width },
				})),
			setRightDockZoneAvailability: (isAvailable, viewport) =>
				set((state) => {
					if (isAvailable !== false)
						return state.isRightDockZoneAvailable === isAvailable
							? state
							: { isRightDockZoneAvailable: isAvailable };
					if (
						state.isRightDockZoneAvailable === false &&
						Object.values(state.panels).every((panel) => !panel.dockedSide) &&
						Object.values(state.detachedPanels).every((panel) => !panel.dockedSide)
					)
						return state;
					const undock = (panel: PanelState): PanelState => {
						if (panel.dockedSide !== "right") return panel;
						return { ...clampPanelIntoViewport(panel, viewport), dockedSide: null };
					};

					return {
						isRightDockZoneAvailable: false,
						panels: Object.fromEntries(
							Object.entries(state.panels).map(([id, panel]) => [id, undock(panel)]),
						),
						detachedPanels: Object.fromEntries(
							Object.entries(state.detachedPanels).map(([id, panel]) => [id, undock(panel)]),
						),
					};
				}),
			setRightDockZoneBounds: (bounds) =>
				set((state) => {
					const current = state.rightDockZoneBounds;
					if (
						current === bounds ||
						(current &&
							bounds &&
							current.left === bounds.left &&
							current.right === bounds.right &&
							current.top === bounds.top &&
							current.bottom === bounds.bottom)
					)
						return state;
					return { rightDockZoneBounds: bounds };
				}),
			dockPanel: (id, side) =>
				set((state) =>
					state.isRightDockZoneAvailable !== true
						? state
						: {
								panels: {
									...state.panels,
									[id]: { ...state.panels[id], dockedSide: side, isUserPositioned: true },
								},
							},
				),
			undockPanel: (id, position) =>
				set((state) => ({
					panels: {
						...state.panels,
						[id]: {
							...state.panels[id],
							dockedSide: null,
							position,
							preferredPosition: position,
							isUserPositioned: true,
						},
					},
				})),
			setIsResizingDockedPanels: (isResizing) => set({ isResizingDockedPanels: isResizing }),
			clampPositions: (viewport) =>
				set((state) => ({
					panels: Object.fromEntries(
						Object.entries(state.panels).map(([id, panel]) => [
							id,
							panel.isOpen && !panel.dockedSide && !panel.isMaximized && panel.position
								? clampPanelIntoViewport(panel, viewport)
								: panel,
						]),
					),
				})),
			maximizePanel: (id) =>
				set((state) => ({
					panels: { ...state.panels, [id]: { ...state.panels[id], isMaximized: true } },
				})),
			restorePanel: (id) =>
				set((state) => ({
					panels: { ...state.panels, [id]: { ...state.panels[id], isMaximized: false } },
				})),
		}),
		{
			name: "floating-panel-state",
			partialize: (state): PersistedFloatingPanelState => ({
				panels: Object.fromEntries(
					Object.entries({ ...state.detachedPanels, ...state.panels }).filter(
						([, panel]) => panel.isUserPositioned || panel.dockedSide === "right",
					),
				),
				sideZoneWidths: state.sideZoneWidths,
			}),
			merge: (persisted, current) => {
				const stored = persisted as Partial<PersistedFloatingPanelState>;
				return {
					...current,
					sideZoneWidths: {
						right: stored.sideZoneWidths?.right ?? current.sideZoneWidths.right,
					},
					detachedPanels: orderPanelsByZIndex(
						Object.fromEntries(
							Object.entries(stored.panels ?? {}).filter(
								([, panel]) => panel.isUserPositioned || panel.dockedSide === "right",
							),
						),
					),
				};
			},
		},
	),
);
