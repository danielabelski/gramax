import type { IconCode } from "@components/Atoms/Icon/LucideIcon";
import { cn } from "@core-ui/utils/cn";
import { Badge } from "@ui-kit/Badge";
import type { ReactNode } from "react";

export interface SearchResultBadgeProps {
	icon?: IconCode;
	text: ReactNode;
	className?: string;
}

export const SearchResultBadge = (props: SearchResultBadgeProps) => {
	const { text, icon, className } = props;

	return (
		<Badge
			className={cn(
				"border-transparent text-primary-fg bg-primary-bg-hover whitespace-nowrap shrink-0",
				className,
			)}
			size="sm"
			startIcon={icon}
		>
			{text}
		</Badge>
	);
};
