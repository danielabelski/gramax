import { TextOverflowTooltip } from "@ui-kit/Tooltip";
import { tv } from "tailwind-variants";

export type TocLinkLevel = 0 | 1 | 2 | 3 | 4;

interface TocLinkProps {
	href: string;
	level: TocLinkLevel;
	active?: boolean;
	children: React.ReactNode;
}

const tocLinkStyles = tv({
	base: "flex h-7 w-full items-center whitespace-nowrap text-xs leading-7 no-underline transition-colors text-muted hover:text-primary-accent",
	variants: {
		level: {
			0: "",
			1: "pl-3",
			2: "pl-6",
			3: "pl-9",
			4: "pl-12",
		},
		active: {
			true: "active text-primary-accent",
			false: "",
		},
	},
	defaultVariants: { level: 0, active: false },
});

export const TocLink = ({ href, level, active = false, children }: TocLinkProps) => (
	<a className={tocLinkStyles({ level, active })} data-qa={`article-navigation-link-level-${level}`} href={href}>
		<TextOverflowTooltip>{children}</TextOverflowTooltip>
	</a>
);
