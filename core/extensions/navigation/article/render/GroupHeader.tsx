import type { HTMLAttributes } from "react";
import { tv } from "tailwind-variants";

interface GroupHeaderProps extends HTMLAttributes<HTMLDivElement> {
	children: React.ReactNode;
}

const groupHeaderStyles = tv({
	base: "group-header text-xs font-medium text-muted w-full h-8 pl-2.5 shrink-0",
});

export const GroupHeader = ({ children, className, ...props }: GroupHeaderProps) => (
	<div className={groupHeaderStyles({ className })} {...props}>
		{children}
	</div>
);
