import { GlassToolbarIcon, GlassToolbarToggleButton, type GlassToolbarToggleButtonProps } from "@ui-kit/GlassToolbar";
import type { IconCode } from "@ui-kit/Icon";

interface AiToolbarButtonProps extends Omit<GlassToolbarToggleButtonProps, "children"> {
	tooltipText: string;
	icon: IconCode;
}

export const AiToolbarButton = ({ tooltipText, icon, ...otherProps }: AiToolbarButtonProps) => {
	return (
		<GlassToolbarToggleButton focusable tooltipText={tooltipText} {...otherProps}>
			<GlassToolbarIcon icon={icon} />
		</GlassToolbarToggleButton>
	);
};
