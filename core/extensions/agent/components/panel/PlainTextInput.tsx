import { cn } from "@core-ui/utils/cn";
import { type ComponentPropsWithoutRef, forwardRef } from "react";

export type PlainTextInputProps = ComponentPropsWithoutRef<"input">;

/**
 * Native input with all chrome stripped so it reads as plain text until edited
 * (e.g. inline chat rename). `ics-ui-kit`'s TextInput can't do this: its border/background
 * live on a wrapper `InputGroup` div styled via `has-[input:focus]:…` selectors that
 * className overrides on the field itself cannot reach or cancel.
 */
export const PlainTextInput = forwardRef<HTMLInputElement, PlainTextInputProps>(({ className, ...props }, ref) => (
	<input
		className={cn("border-none bg-transparent p-0 [font:inherit] text-inherit outline-none", className)}
		ref={ref}
		{...props}
	/>
));

PlainTextInput.displayName = "PlainTextInput";
