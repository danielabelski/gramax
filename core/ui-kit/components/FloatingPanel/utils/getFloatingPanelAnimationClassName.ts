import type { PanelAnimationOrigin } from "../types/FloatingPanelTypes";

export const getFloatingPanelAnimationClassName = (
	presenceState: "open" | "closed",
	animationOrigin: PanelAnimationOrigin,
) => {
	if (presenceState === "closed")
		return "pointer-events-none animate-out fade-out-0 zoom-out-95 [animation-fill-mode:forwards]";

	const slideClassName = animationOrigin.endsWith("left") ? "slide-in-from-left-2" : "slide-in-from-right-2";
	return `animate-in fade-in-0 zoom-in-95 ${slideClassName}`;
};
