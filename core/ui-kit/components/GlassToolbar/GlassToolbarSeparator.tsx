import { GlassToolbarSeparator as UiKitGlassToolbarSeparator } from "ics-ui-kit/components/glass-toolbar";
import { forwardRef } from "react";
import { tv, type VariantProps } from "tailwind-variants";
import type { ExtractComponentGeneric } from "../../lib/extractComponentGeneric";

type UiKitGlassToolbarSeparatorProps = ExtractComponentGeneric<typeof UiKitGlassToolbarSeparator>;

const glassToolbarSeparatorStyles = tv({
	base: "h-[18px] shrink-0",
	variants: {
		variant: {
			inline: "bg-alpha-high-80",
			bottom: "bg-alpha-high-90",
		},
	},
	defaultVariants: {
		variant: "bottom",
	},
});

export interface GlassToolbarSeparatorProps
	extends UiKitGlassToolbarSeparatorProps,
		VariantProps<typeof glassToolbarSeparatorStyles> {}

export const GlassToolbarSeparator = forwardRef<HTMLDivElement, GlassToolbarSeparatorProps>((props, ref) => {
	const { className, variant, ...otherProps } = props;
	return (
		<UiKitGlassToolbarSeparator
			className={glassToolbarSeparatorStyles({ className, variant })}
			ref={ref}
			{...otherProps}
		/>
	);
});
