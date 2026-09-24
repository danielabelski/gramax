import t from "@ext/localization/locale/translate";
import { FloatingIconButton } from "@ui-kit/FloatingPanel";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@ui-kit/Tooltip";

export const DockedAction = ({ onUndock }: { onUndock: () => void }) => {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<FloatingIconButton icon="picture-in-picture-2" onClick={onUndock} size="xs" />
				</TooltipTrigger>
				<TooltipContent side="bottom">{t("floating-panel.undock")}</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};
