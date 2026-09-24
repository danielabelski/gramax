import { cn } from "@core-ui/utils/cn";
import type { ReactNode } from "react";
import { RIGHT_NAVIGATION_CONTAINER_WIDTH } from "./constants";

interface RightNavigationLayoutProps {
	children: ReactNode;
	className?: string;
}

const RightNavigationLayout = (props: RightNavigationLayoutProps) => {
	const { children, className } = props;
	return (
		<div
			className={cn("right-nav flex h-full w-full min-h-0 flex-col", className)}
			style={{ pointerEvents: "none", width: RIGHT_NAVIGATION_CONTAINER_WIDTH }}
		>
			{children}
		</div>
	);
};

export default RightNavigationLayout;
