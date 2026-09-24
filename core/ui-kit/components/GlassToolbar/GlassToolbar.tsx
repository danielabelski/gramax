import { ComponentVariantProvider } from "@ui-kit/Providers";
import { GlassToolbar as UiKitGlassToolbar } from "ics-ui-kit/components/glass-toolbar";
import { forwardRef } from "react";
import { tv } from "tailwind-variants";
import type { ExtractComponentGeneric } from "../../lib/extractComponentGeneric";

export const glassToolbarVariants = tv({
	base: "h-10",
	variants: {
		single: {
			true: "p-0 [&>button]:p-3 overflow-visible",
			false: "p-1",
		},
	},
	defaultVariants: {
		single: false,
	},
});

export type GlassToolbarProps = ExtractComponentGeneric<typeof UiKitGlassToolbar> & {
	/** Use `single` only when the toolbar contains exactly one button. */
	variant?: "single" | "default";
};

export const GlassToolbar = forwardRef<HTMLDivElement, GlassToolbarProps>((props, ref) => {
	const { className, variant, ...otherProps } = props;
	return (
		<ComponentVariantProvider variant="glass">
			<UiKitGlassToolbar
				className={glassToolbarVariants({ single: variant === "single", className })}
				ref={ref}
				{...otherProps}
			/>
		</ComponentVariantProvider>
	);
});
