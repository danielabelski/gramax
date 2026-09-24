import { PopoverContent as UiKitPopoverContent } from "ics-ui-kit/components/popover";
import { forwardRef } from "react";
import type { ExtractComponentGeneric } from "../../lib/extractComponentGeneric";
import { VIEWPORT_PADDING } from "../../lib/floating";

export interface UiKitPopoverContentProps extends ExtractComponentGeneric<typeof UiKitPopoverContent> {}

export const PopoverContent = forwardRef<HTMLDivElement, UiKitPopoverContentProps>(
	({ collisionPadding = VIEWPORT_PADDING, ...props }, ref) => {
		return <UiKitPopoverContent collisionPadding={collisionPadding} ref={ref} {...props} />;
	},
);
