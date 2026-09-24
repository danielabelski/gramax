import { cn } from "@core-ui/utils/cn";
import { TableHead as UiTableHead } from "ics-ui-kit/components/table";
import { type ComponentPropsWithoutRef, type ElementRef, forwardRef } from "react";

export const TableHead = forwardRef<ElementRef<typeof UiTableHead>, ComponentPropsWithoutRef<typeof UiTableHead>>(
	({ className, ...props }, ref) => <UiTableHead className={cn("border-r-0", className)} ref={ref} {...props} />,
);

TableHead.displayName = "TableHead";
