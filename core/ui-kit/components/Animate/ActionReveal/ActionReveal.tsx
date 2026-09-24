import { cn } from "ics-ui-kit/lib/utils";
import type { CSSProperties, PropsWithChildren } from "react";

type ActionRevealProps = PropsWithChildren<{
	className?: string;
	contentClassName?: string;
	isVisible?: boolean;
	revealOnGroupInteraction?: boolean;
	width: string;
}>;

type ActionRevealStyle = CSSProperties & {
	"--action-reveal-width": string;
};

export const ActionReveal = ({
	children,
	className,
	contentClassName,
	isVisible = false,
	revealOnGroupInteraction = false,
	width,
}: ActionRevealProps) => {
	const revealWidthClass = "w-[var(--action-reveal-width)] [transition-delay:0ms]";
	const revealContentClass =
		"translate-x-0 opacity-100 delay-50 duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]";

	return (
		<span
			className={cn(
				"flex w-0 overflow-hidden [transition:width_140ms_cubic-bezier(0.23,1,0.32,1)_80ms] motion-reduce:transition-none",
				revealOnGroupInteraction &&
					"group-hover:w-[var(--action-reveal-width)] group-focus-within:w-[var(--action-reveal-width)]",
				isVisible && revealWidthClass,
				className,
			)}
			data-state={isVisible ? "visible" : "hidden"}
			style={{ "--action-reveal-width": width } as ActionRevealStyle}
		>
			<span
				className={cn(
					"flex translate-x-2 opacity-0 transition-[transform,opacity] duration-100 ease-out motion-reduce:transition-none",
					revealOnGroupInteraction &&
						"group-hover:translate-x-0 group-hover:opacity-100 group-hover:delay-50 group-hover:duration-150 group-focus-within:translate-x-0 group-focus-within:opacity-100",
					isVisible && revealContentClass,
					contentClassName,
				)}
			>
				{children}
			</span>
		</span>
	);
};
