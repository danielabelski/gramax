import LucideIcon, { type IconCode } from "@components/Atoms/Icon/LucideIcon";
import { TriggerButton as UiKitTriggerButton } from "ics-ui-kit/components/button";
import { forwardRef } from "react";
import type { ExtractComponentGeneric } from "../../lib/extractComponentGeneric";

export type UiKitTriggerButtonProps = ExtractComponentGeneric<typeof UiKitTriggerButton>;

export interface TriggerButtonProps extends Omit<UiKitTriggerButtonProps, "startIcon" | "endIcon"> {
	startIcon?: IconCode;
	endIcon?: IconCode;
}

export const TriggerButton = forwardRef<HTMLButtonElement, TriggerButtonProps>((props, ref) => {
	const { startIcon, endIcon, ...otherProps } = props;
	const StartIcon = startIcon && LucideIcon(startIcon);
	const EndIcon = endIcon && LucideIcon(endIcon);

	return (
		<UiKitTriggerButton data-qa="qa-clickable" endIcon={EndIcon} ref={ref} startIcon={StartIcon} {...otherProps} />
	);
});
