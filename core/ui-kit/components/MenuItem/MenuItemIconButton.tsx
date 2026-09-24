import LucideIcon from "@components/Atoms/Icon/LucideIcon";
import { MenuItemIconButton as UiKitMenuItemIconButton } from "ics-ui-kit/components/menu-item";
import { forwardRef } from "react";
import type { ExtractComponentGeneric } from "../../lib/extractComponentGeneric";

type UiKitMenuItemIconButtonProps = ExtractComponentGeneric<typeof UiKitMenuItemIconButton>;

export interface MenuItemIconButtonProps extends Omit<UiKitMenuItemIconButtonProps, "icon"> {
	icon?: string;
}

export const MenuItemIconButton = forwardRef<HTMLButtonElement, MenuItemIconButtonProps>((props, ref) => {
	const { icon, ...otherProps } = props;
	const Icon = icon && LucideIcon(icon);
	if (!Icon) return null;

	// biome-ignore lint/suspicious/noExplicitAny: expected
	return <UiKitMenuItemIconButton icon={Icon as any} ref={ref} {...otherProps} />;
});
