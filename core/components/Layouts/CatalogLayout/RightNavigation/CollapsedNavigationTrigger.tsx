import {
	GlassToolbarIcon,
	type GlassToolbarIconProps,
	GlassToolbarToggleButton,
	type GlassToolbarToggleButtonProps,
} from "@ui-kit/GlassToolbar";
import { forwardRef } from "react";

interface CollapsedNavigationTriggerProps extends Omit<GlassToolbarToggleButtonProps, "children" | "tooltipText"> {
	icon: GlassToolbarIconProps["icon"];
	label: string;
}

export const CollapsedNavigationTrigger = forwardRef<HTMLButtonElement, CollapsedNavigationTriggerProps>(
	({ icon, label, ...props }, ref) => (
		<GlassToolbarToggleButton {...props} aria-label={label} focusable ref={ref}>
			<GlassToolbarIcon icon={icon} />
		</GlassToolbarToggleButton>
	),
);

CollapsedNavigationTrigger.displayName = "CollapsedNavigationTrigger";
