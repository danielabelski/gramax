import { cn } from "@core-ui/utils/cn";
import type { HTMLAttributes } from "react";

type CatalogViewSectionProps = HTMLAttributes<HTMLDivElement>;

export const CatalogViewSection = ({ className, ...props }: CatalogViewSectionProps) => {
	return <div className={cn("w-full p-3 pb-1", className)} {...props} />;
};
