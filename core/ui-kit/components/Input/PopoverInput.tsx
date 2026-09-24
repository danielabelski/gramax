import { cn } from "@core-ui/utils/cn";
import { TextInput as UiKitTextInput } from "ics-ui-kit/components/input";
import { type ComponentPropsWithoutRef, forwardRef } from "react";

export type PopoverInputProps = ComponentPropsWithoutRef<typeof UiKitTextInput>;

export const PopoverInput = forwardRef<HTMLInputElement, PopoverInputProps>(({ className, ...props }, ref) => (
	<UiKitTextInput
		className={cn(
			"!shadow-none hover:!shadow-none active:!shadow-none focus:!shadow-none focus-visible:!shadow-none",
			"invalid:!shadow-none invalid:hover:!shadow-none invalid:focus:!shadow-none",
			"aria-[invalid=true]:!shadow-none aria-[invalid=true]:hover:!shadow-none aria-[invalid=true]:focus:!shadow-none",
			"read-only:!shadow-none disabled:!shadow-none",
			className,
		)}
		ref={ref}
		{...props}
	/>
));

PopoverInput.displayName = "PopoverInput";
