import { cn } from "@core-ui/utils/cn";
import { IconButton } from "@ui-kit/Button";
import { forwardRef } from "react";
import type { ExtractComponentGeneric } from "../../../lib/extractComponentGeneric";

export type FloatingIconButtonProps = ExtractComponentGeneric<typeof IconButton>;

export const FloatingIconButton = forwardRef<HTMLButtonElement, FloatingIconButtonProps>((props, ref) => {
	const { className, ...otherProps } = props;

	return (
		<IconButton
			className={cn("size-[30px] shrink-0 p-1 text-muted active:text-primary-fg", className)}
			ref={ref}
			size="xs"
			variant="ghost"
			{...otherProps}
		/>
	);
});
