import type { ReactNode } from "react";

interface MainToolbarLayoutProps {
	agentButton: ReactNode;
	children?: ReactNode;
}

export const MainToolbarLayout = ({ agentButton, children }: MainToolbarLayoutProps) => (
	<div className="flex max-w-full items-center gap-2">
		<div className="min-w-0 max-w-full">{children}</div>
		<div className="shrink-0 empty:hidden">{agentButton}</div>
	</div>
);

export const MainToolbarScrollViewport = ({ children }: Pick<MainToolbarLayoutProps, "children">) => (
	<div className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto [scrollbar-width:none]">{children}</div>
);
