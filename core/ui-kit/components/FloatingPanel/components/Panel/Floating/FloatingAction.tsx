import t from "@ext/localization/locale/translate";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@ui-kit/Dropdown";
import { FloatingIconButton } from "@ui-kit/FloatingPanel/components/FloatingIconButton";
import { FloatingTriggerButton } from "@ui-kit/FloatingPanel/components/FloatingTriggerButton";
import { Icon } from "@ui-kit/Icon";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@ui-kit/Tooltip";
import { MAXIMIZED_PANEL_Z_INDEX } from "../../../constants";
import { useFloatingPanelStore } from "../../../store/useFloatingPanelStore";
import type { SideZoneSide } from "../../../types/FloatingPanelTypes";

type FloatingActionProps = {
	onDock: (side: SideZoneSide) => void;
	isMaximized: boolean;
	onMaximize: () => void;
	onRestore: () => void;
	onResetSize: () => void;
};

export const FloatingAction = ({ onDock, isMaximized, onMaximize, onRestore, onResetSize }: FloatingActionProps) => {
	const canDock = useFloatingPanelStore((state) => state.isRightDockZoneAvailable === true);

	if (isMaximized)
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<FloatingIconButton icon="minimize" onClick={onRestore} size="xs" />
					</TooltipTrigger>
					<TooltipContent side="bottom" style={{ zIndex: MAXIMIZED_PANEL_Z_INDEX }}>
						{t("floating-panel.restore")}
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);

	return (
		<ComponentVariantProvider variant="glass">
			<DropdownMenu>
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<DropdownMenuTrigger asChild>
								<FloatingTriggerButton aria-label={t("floating-panel.actions")} size="xs">
									<Icon className="stroke-[2.34px]" icon="maximize" size="sm" />
								</FloatingTriggerButton>
							</DropdownMenuTrigger>
						</TooltipTrigger>
						<TooltipContent side="bottom" style={{ zIndex: MAXIMIZED_PANEL_Z_INDEX }}>
							{t("floating-panel.actions")}
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				<DropdownMenuContent align="start" style={{ zIndex: MAXIMIZED_PANEL_Z_INDEX }}>
					{canDock && (
						<DropdownMenuItem onSelect={() => onDock("right")}>
							<Icon icon="panel-right" />
							{t("floating-panel.dock-right")}
						</DropdownMenuItem>
					)}

					<DropdownMenuItem onSelect={onMaximize}>
						<Icon icon="expand" />
						{t("floating-panel.maximize")}
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onSelect={onResetSize}>
						<Icon icon="rotate-ccw" />
						{t("floating-panel.reset-size")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</ComponentVariantProvider>
	);
};
