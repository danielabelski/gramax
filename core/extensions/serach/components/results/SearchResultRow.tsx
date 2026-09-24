import type { ReactNode } from "react";
import { tv, type VariantProps } from "tailwind-variants";

const searchResultRow = tv({
	base: "px-2.5 py-1.5 text-sm",
	variants: {
		tone: {
			plain: "",
			body: "font-normal text-secondary-fg",
			emphasis: "font-medium text-secondary-fg",
			heading: "font-medium",
			badge: "leading-none",
		},
	},
	defaultVariants: { tone: "body" },
});

export interface SearchResultRowProps extends VariantProps<typeof searchResultRow> {
	children: ReactNode;
	className?: string;
}

export const SearchResultRow = (props: SearchResultRowProps) => {
	const { children, tone, className } = props;

	return <div className={searchResultRow({ tone, className })}>{children}</div>;
};
