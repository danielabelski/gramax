import type { ReactNode, Ref } from "react";
import { VIEWPORT_PADDING } from "../../../../ui-kit/lib/floating";

const SLOT = ["fixed min-w-[var(--sidebar-width)]", "z-[var(--z-index-nav-layout)] print:hidden"].join(" ");

interface LeftNavigationSlotProps {
	children: ReactNode;
	containerRef?: Ref<HTMLDivElement>;
}

export const LeftNavigationSlot = ({ children, containerRef }: LeftNavigationSlotProps) => (
	<div className={SLOT} ref={containerRef} style={{ bottom: VIEWPORT_PADDING, left: VIEWPORT_PADDING }}>
		{children}
	</div>
);

export default LeftNavigationSlot;
