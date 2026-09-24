import type { IconCode } from "@ui-kit/Icon";

export type Position = {
	x: number;
	y: number;
};

export type Viewport = {
	width: number;
	height: number;
};

export type DockZoneBounds = {
	left: number;
	right: number;
	top: number;
	bottom: number;
};

export type Size = {
	width: number;
	height: number;
};

export type PanelId = string;

export type SideZoneSide = "right";

export type PanelSlot = "content" | "header";

export type PanelAnimationOrigin = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export type PanelDefinition = {
	id: PanelId;
	title: string;
	icon?: IconCode;
	interactionDisabled?: boolean;
};

export type PanelState = PanelDefinition & {
	position: Position | null;
	preferredPosition: Position | null;
	isUserPositioned: boolean;
	size: Size;
	isOpen: boolean;
	zIndex: number;
	dockedSide: SideZoneSide | null;
	isMaximized: boolean;
	animationOrigin: PanelAnimationOrigin;
};
