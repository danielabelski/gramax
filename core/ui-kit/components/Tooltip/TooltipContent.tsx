import { cn } from "@core-ui/utils/cn";
import { TooltipArrow, TooltipContent as UiKitTooltipContent } from "ics-ui-kit/components/tooltip";
import type { ExtractComponentGeneric } from "../../lib/extractComponentGeneric";
import { VIEWPORT_PADDING } from "../../lib/floating";

type UiKitTooltipContentProps = ExtractComponentGeneric<typeof UiKitTooltipContent>;

interface TooltipContentProps extends Omit<UiKitTooltipContentProps, "focus"> {
	focus?: "default" | "high";
	arrow?: boolean;
}

export const TooltipContent = (props: TooltipContentProps) => {
	const {
		children,
		className,
		focus = "high",
		arrow = false,
		style = { maxWidth: "20rem" },
		collisionPadding = VIEWPORT_PADDING,
		...otherProps
	} = props;
	return (
		<UiKitTooltipContent
			{...otherProps}
			className={cn(className, "hidden sm:block [@media(hover:none)]:hidden")}
			collisionPadding={collisionPadding}
			focus={focus === "high" ? "high" : undefined}
			style={style}
		>
			{children}
			{arrow && <TooltipArrow />}
		</UiKitTooltipContent>
	);
};
