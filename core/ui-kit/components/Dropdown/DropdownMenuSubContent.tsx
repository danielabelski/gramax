import { cn } from "@core-ui/utils/cn";
import { DropdownMenuSubContent as UiKitDropdownMenuSubContent } from "ics-ui-kit/components/dropdown";
import { type FC, forwardRef } from "react";
import type { ExtractComponentGeneric } from "../../lib/extractComponentGeneric";
import { VIEWPORT_PADDING } from "../../lib/floating";

interface UiKitDropdownMenuSubContentProps extends ExtractComponentGeneric<typeof UiKitDropdownMenuSubContent> {}

export const DropdownMenuSubContent: FC<UiKitDropdownMenuSubContentProps> = forwardRef(
	({ className, collisionPadding = VIEWPORT_PADDING, ...props }, ref) => {
		return (
			<UiKitDropdownMenuSubContent
				{...props}
				className={cn(
					"max-h-[var(--radix-dropdown-menu-content-available-height)] !overflow-y-auto",
					className,
				)}
				collisionPadding={collisionPadding}
				data-dropdown-menu-sub-content
				data-qa="dropdown-menu-content"
				data-testid="sub-content"
				ref={ref}
			/>
		);
	},
);
