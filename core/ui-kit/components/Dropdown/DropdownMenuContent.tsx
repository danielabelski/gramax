import { DropdownMenuContent as UiKitDropdownMenuContent } from "ics-ui-kit/components/dropdown";
import { type FC, forwardRef } from "react";
import type { ExtractComponentGeneric } from "../../lib/extractComponentGeneric";
import { VIEWPORT_PADDING } from "../../lib/floating";

interface UiKitDropdownMenuContentProps extends ExtractComponentGeneric<typeof UiKitDropdownMenuContent> {}

export const DropdownMenuContent: FC<UiKitDropdownMenuContentProps> = forwardRef(
	({ collisionPadding = VIEWPORT_PADDING, ...props }, ref) => {
		return (
			<UiKitDropdownMenuContent
				collisionPadding={collisionPadding}
				ref={ref}
				{...props}
				data-dropdown-menu-content
				data-qa="dropdown-content"
				data-testid="dropdown-content"
			/>
		);
	},
);
