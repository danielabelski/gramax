import type { ReactNode } from "react";

export const UserBadgesWrapper = ({ children }: { children: ReactNode }) => {
	return <div className="flex items-center gap-1.5 whitespace-nowrap">{children}</div>;
};
