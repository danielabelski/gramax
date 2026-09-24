import { cn } from "@core-ui/utils/cn";
import { Children, type ReactNode } from "react";
import { useFloatingPanelStore } from "../../store/useFloatingPanelStore";
import type { SideZoneSide } from "../../types/FloatingPanelTypes";

type SideZoneStackProps = {
	side: SideZoneSide;
	children: ReactNode;
	className?: string;
	maxWidth?: number;
	reserveWidth?: boolean;
};

export const SideZoneStack = ({ side, children, className, maxWidth, reserveWidth = true }: SideZoneStackProps) => {
	const width = useFloatingPanelStore((state) => state.sideZoneWidths[side]);
	const effectiveWidth = maxWidth === undefined ? width : Math.min(width, maxWidth);

	return (
		<div
			className={cn(
				"pointer-events-none absolute inset-y-0 z-[var(--z-index-toolbar)] shrink-0",
				"right-0",
				className,
			)}
			data-side-zone-stack={side}
			style={reserveWidth ? { width: effectiveWidth } : undefined}
		>
			{Children.map(children, (child) => (
				<div className="pointer-events-none absolute inset-0 [&>*]:pointer-events-auto">{child}</div>
			))}
		</div>
	);
};
