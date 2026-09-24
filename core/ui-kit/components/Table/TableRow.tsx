import { cn } from "@core-ui/utils/cn";
import { TableRow as UiTableRow } from "ics-ui-kit/components/table";
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from "react";

export const TableRow = forwardRef<ElementRef<typeof UiTableRow>, ComponentPropsWithoutRef<typeof UiTableRow>>(
	({ className, ...props }, ref) => <UiTableRow className={cn("[&>*]:border-b-0", className)} ref={ref} {...props} />,
);

TableRow.displayName = "TableRow";
