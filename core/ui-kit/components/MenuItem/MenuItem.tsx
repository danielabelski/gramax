import { narrowVariant, useComponentVariant } from "@ui-kit/hooks/useComponentVariant";
import { MENU_ITEM_ANATOMY, MenuItem as UiKitMenuItem } from "ics-ui-kit/components/menu-item";
import { forwardRef } from "react";
import { tv } from "tailwind-variants";
import type { ExtractComponentGeneric } from "../../lib/extractComponentGeneric";

export type MenuItemProps = ExtractComponentGeneric<typeof UiKitMenuItem>;

const glassMenuItemStyles = tv({
	base: [
		...MENU_ITEM_ANATOMY,
		"rounded-lg bg-transparent text-primary-fg",
		"hover:bg-secondary-border focus:bg-secondary-border",
	],
	variants: {
		disabled: {
			true: "pointer-events-none opacity-50",
		},
	},
});

export const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(({ className, disabled, ...props }, ref) => {
	const { variant } = useComponentVariant();

	if (!narrowVariant(variant, ["glass"]))
		return <UiKitMenuItem className={className} disabled={disabled} ref={ref} {...props} />;

	return <div className={glassMenuItemStyles({ className, disabled })} ref={ref} {...props} />;
});

MenuItem.displayName = "MenuItem";
