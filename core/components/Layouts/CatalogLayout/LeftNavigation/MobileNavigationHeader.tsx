import type { ReactNode } from "react";
import { VIEWPORT_PADDING } from "../../../../ui-kit/lib/floating";

interface MobileNavigationHeaderProps {
	children: ReactNode;
}

export const MobileNavigationHeader = ({ children }: MobileNavigationHeaderProps) => (
	<div
		className="absolute w-fit lg:hidden"
		style={{
			zIndex: "var(--z-index-header-navigation)",
			left: VIEWPORT_PADDING,
			top: `calc(var(--catalog-titlebar-offset,0rem) + ${VIEWPORT_PADDING}px)`,
		}}
	>
		{children}
	</div>
);
