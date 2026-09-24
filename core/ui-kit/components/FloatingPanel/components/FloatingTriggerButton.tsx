import { cn } from "@core-ui/utils/cn";
import { TriggerButton, type TriggerButtonProps } from "@ui-kit/Button";
import { forwardRef } from "react";

export type FloatingTriggerButtonProps = TriggerButtonProps;

export const FloatingTriggerButton = forwardRef<HTMLButtonElement, FloatingTriggerButtonProps>((props, ref) => {
	const { className, ...otherProps } = props;

	return (
		<TriggerButton
			className={cn(
				"size-[30px] shrink-0 p-1 text-muted active:text-primary-fg data-[state=open]:text-primary-fg",
				className,
			)}
			ref={ref}
			size="xs"
			variant="ghost"
			{...otherProps}
		/>
	);
});
