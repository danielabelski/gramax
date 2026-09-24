import { VIEWPORT_PADDING } from "../../../../ui-kit/lib/floating";

const RIGHT_NAVIGATION_CONTROLS_HEIGHT = 40;

export const RIGHT_NAVIGATION_WIDTH = 240;
export const RIGHT_NAVIGATION_CONTAINER_WIDTH = RIGHT_NAVIGATION_WIDTH + VIEWPORT_PADDING * 2;
export const RIGHT_NAVIGATION_PANEL_INSET = RIGHT_NAVIGATION_CONTROLS_HEIGHT + VIEWPORT_PADDING * 2;

// Tailwind arbitrary variants cannot interpolate, so the container-query widths below are repeated here.
export const RIGHT_NAVIGATION_EXPAND_WIDTH_PINNED = 1024;
export const RIGHT_NAVIGATION_EXPAND_WIDTH_UNPINNED = 1284;

export const EXPANDED_RIGHT_NAVIGATION_CLASS_NAME =
	"hidden [@container_catalog-viewport_(min-width:_1024px)]:[html[data-left-sidebar-pinned=true]_&]:block [@container_catalog-viewport_(min-width:_1284px)]:[html[data-left-sidebar-pinned=false]_&]:block";

export const EXPANDED_RIGHT_NAVIGATION_CONTENT_CLASS_NAME =
	"hidden [@container_catalog-viewport_(min-width:_1024px)]:[html[data-left-sidebar-pinned=true]_&]:contents [@container_catalog-viewport_(min-width:_1284px)]:[html[data-left-sidebar-pinned=false]_&]:contents";

export const COLLAPSED_RIGHT_NAVIGATION_CONTENT_CLASS_NAME =
	"contents [@container_catalog-viewport_(min-width:_1024px)]:[html[data-left-sidebar-pinned=true]_&]:hidden [@container_catalog-viewport_(min-width:_1284px)]:[html[data-left-sidebar-pinned=false]_&]:hidden";
