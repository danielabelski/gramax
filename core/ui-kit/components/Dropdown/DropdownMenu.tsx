import { DropdownMenu as UiKitDropdownMenu } from "ics-ui-kit/components/dropdown";
import { type FC, useCallback, useState } from "react";
import type { ExtractComponentGeneric } from "../../lib/extractComponentGeneric";
import { DropdownMenuOpenContext } from "./DropdownMenuOpenContext";

interface UiKitDropdownMenuProps extends ExtractComponentGeneric<typeof UiKitDropdownMenu> {}

export const DropdownMenu: FC<UiKitDropdownMenuProps> = (props) => {
	const { open, defaultOpen, onOpenChange, ...otherProps } = props;
	const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
	const isOpen = open ?? uncontrolledOpen;

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			setUncontrolledOpen(nextOpen);
			onOpenChange?.(nextOpen);
		},
		[onOpenChange],
	);

	return (
		<DropdownMenuOpenContext.Provider value={isOpen}>
			<UiKitDropdownMenu
				{...otherProps}
				data-dropdown-menu
				data-testid="dropdown"
				onOpenChange={handleOpenChange}
				open={isOpen}
			/>
		</DropdownMenuOpenContext.Provider>
	);
};
