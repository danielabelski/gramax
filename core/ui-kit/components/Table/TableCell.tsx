import { cn } from "@core-ui/utils/cn";
import { TableCell as UiTableCell } from "ics-ui-kit/components/table";
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from "react";

export const TableCell = forwardRef<ElementRef<typeof UiTableCell>, ComponentPropsWithoutRef<typeof UiTableCell>>(
	({ className, ...props }, ref) => <UiTableCell className={cn("border-r-0", className)} ref={ref} {...props} />,
);

TableCell.displayName = "TableCell";
