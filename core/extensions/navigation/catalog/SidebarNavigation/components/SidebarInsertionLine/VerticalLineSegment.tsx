import { cn } from "@core-ui/utils/cn";
import type { CSSProperties } from "react";

export const VerticalLineSegment = ({ className, style }: { className?: string; style?: CSSProperties }) => {
	return (
		<span
			className={cn(
				"pointer-events-none absolute -top-0.5 bottom-0 z-10 w-px rounded-full bg-primary-border",
				className,
			)}
			style={style}
		/>
	);
};
