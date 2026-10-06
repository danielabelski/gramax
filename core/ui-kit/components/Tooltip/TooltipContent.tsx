import { cn } from "@core-ui/utils/cn";
import { TooltipArrow, TooltipContent as UiKitTooltipContent } from "ics-ui-kit/components/tooltip";
import type { ExtractComponentGeneric } from "../../lib/extractComponentGeneric";
import { VIEWPORT_PADDING } from "../../lib/floating";
import { useIsTouchTooltip } from "./TooltipWithContextCheck";

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
	const isTouchTooltip = useIsTouchTooltip();
	return (
		<UiKitTooltipContent
			{...otherProps}
			className={cn(className, !isTouchTooltip && "hidden sm:block [@media(hover:none)]:hidden")}
			collisionPadding={collisionPadding}
			focus={focus === "high" ? "high" : undefined}
			style={style}
		>
			{children}
			{arrow && <TooltipArrow />}
		</UiKitTooltipContent>
	);
};
