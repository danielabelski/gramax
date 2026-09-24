import LucideIcon, { type IconCode } from "@components/Atoms/Icon/LucideIcon";
import { GlassToolbarIcon as UiKitToolbarIcon } from "ics-ui-kit/components/glass-toolbar";
import { forwardRef } from "react";
import type { ExtractComponentGeneric } from "../../lib/extractComponentGeneric";

type UiKitToolbarIconProps = ExtractComponentGeneric<typeof UiKitToolbarIcon>;

export interface GlassToolbarIconProps extends Omit<UiKitToolbarIconProps, "icon"> {
	icon?: IconCode;
}

export const GlassToolbarIcon = forwardRef<SVGSVGElement, GlassToolbarIconProps>((props, ref) => {
	const { icon, ...otherProps } = props;
	const Icon = icon && typeof icon === "string" && LucideIcon(icon);
	if (!Icon) return null;

	// biome-ignore lint/suspicious/noExplicitAny: expected
	return <UiKitToolbarIcon icon={Icon as any} ref={ref} {...otherProps} />;
});
