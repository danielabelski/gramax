import { cn } from "@core-ui/utils/cn";
import { TableHeader as UiTableHeader } from "ics-ui-kit/components/table";
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from "react";

export const TableHeader = forwardRef<ElementRef<typeof UiTableHeader>, ComponentPropsWithoutRef<typeof UiTableHeader>>(
	({ className, ...props }, ref) => (
		<UiTableHeader className={cn("[&_th]:border-b-0", className)} ref={ref} {...props} />
	),
);

TableHeader.displayName = "TableHeader";
