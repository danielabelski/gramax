import LucideIcon from "@components/Atoms/Icon/LucideIcon";
import { Badge as UiKitBadge } from "ics-ui-kit/components/badge";
import { type ComponentProps, forwardRef } from "react";

type UiKitBadgeProps = ComponentProps<typeof UiKitBadge>;

export interface BadgeProps extends Omit<UiKitBadgeProps, "startIcon" | "endIcon"> {
	startIcon?: string;
	endIcon?: string;
}

export const Badge = forwardRef<HTMLElement, BadgeProps>((props, ref) => {
	const { startIcon, endIcon, ...otherProps } = props;
	const StartIcon = startIcon && LucideIcon(startIcon);
	const EndIcon = endIcon && LucideIcon(endIcon);

	// biome-ignore lint/suspicious/noExplicitAny: expected
	return <UiKitBadge endIcon={EndIcon as any} ref={ref} startIcon={StartIcon as any} {...otherProps} />;
});
