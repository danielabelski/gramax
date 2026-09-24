import { cn } from "@core-ui/utils/cn";
import { forwardRef } from "react";

export type GlassToolbarGroupProps = React.HTMLAttributes<HTMLDivElement>;

export const GlassToolbarGroup = forwardRef<HTMLDivElement, GlassToolbarGroupProps>((props, ref) => {
	const { className, ...otherProps } = props;
	// biome-ignore lint/a11y/useSemanticElements: expected
	return <div className={cn("flex items-center gap-0.5", className)} ref={ref} role="group" {...otherProps} />;
});
