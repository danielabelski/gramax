import LucideIcon from "@components/Atoms/Icon/LucideIcon";
import type { IconCode } from "@ui-kit/Icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { DropdownMenuTriggerButton as UiKitDropdownMenuTriggerButton } from "ics-ui-kit/components/dropdown";
import { type ComponentProps, forwardRef, type ReactNode } from "react";
import { useDropdownMenuOpen } from "./DropdownMenuOpenContext";

type UiKitDropdownMenuTriggerButtonProps = ComponentProps<typeof UiKitDropdownMenuTriggerButton>;

export interface DropdownMenuTriggerButtonProps
	extends Omit<UiKitDropdownMenuTriggerButtonProps, "startIcon" | "endIcon"> {
	startIcon?: IconCode;
	endIcon?: IconCode;
	tooltip?: ReactNode;
}

export const DropdownMenuTriggerButton = forwardRef<HTMLButtonElement, DropdownMenuTriggerButtonProps>((props, ref) => {
	const { startIcon, endIcon, tooltip, ...otherProps } = props;
	const isOpen = useDropdownMenuOpen();
	const lucideStartIcon = startIcon && LucideIcon(startIcon);
	const lucideEndIcon = endIcon && LucideIcon(endIcon);

	// TooltipTrigger clones the button and overwrites `data-state` with the tooltip state,
	// which kills the open-state styles, so pass the dropdown state explicitly.
	const dataState = isOpen === undefined ? undefined : isOpen ? "open" : "closed";
	const button = (
		<UiKitDropdownMenuTriggerButton
			data-state={dataState}
			endIcon={lucideEndIcon}
			ref={ref}
			startIcon={lucideStartIcon}
			{...otherProps}
		/>
	);

	if (!tooltip) return button;

	return (
		<Tooltip>
			<TooltipContent>{tooltip}</TooltipContent>
			<TooltipTrigger asChild>{button}</TooltipTrigger>
		</Tooltip>
	);
});
