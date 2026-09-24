import t from "@ext/localization/locale/translate";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@ui-kit/Dropdown";
import { FloatingTriggerButton } from "@ui-kit/FloatingPanel";
import { Icon } from "@ui-kit/Icon";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import { Switch } from "@ui-kit/Switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { useDiffExtendedMode, useSetDiffExtendedMode } from "../store/DiffExtendedModeStore";

const DiffExtendedModeToggle = () => {
	const extendedMode = useDiffExtendedMode();
	const setDiffExtendedMode = useSetDiffExtendedMode();

	return (
		<ComponentVariantProvider variant="glass">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<FloatingTriggerButton aria-label={t("actions")} data-testid="diff-extended-mode-trigger" size="xs">
						<Icon className="h-3.5 w-3.5" icon="ellipsis" />
					</FloatingTriggerButton>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem
						onClick={(ev) => {
							ev.preventDefault();
							ev.stopPropagation();
							setDiffExtendedMode(!extendedMode);
						}}
					>
						<div className="flex items-center justify-between w-full gap-4">
							<div className="flex items-center gap-1">
								{t("git.merge-requests.advanced-mode")}
								<Tooltip>
									<TooltipTrigger>
										<Icon icon="circle-help" />
									</TooltipTrigger>
									<TooltipContent>{t("git.merge-requests.advanced-mode-description")}</TooltipContent>
								</Tooltip>
							</div>
							<Switch
								checked={extendedMode}
								onChange={(ev) => {
									ev.preventDefault();
									ev.stopPropagation();
								}}
								onCheckedChange={(toggled) => setDiffExtendedMode(toggled)}
								size="xs"
							/>
						</div>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</ComponentVariantProvider>
	);
};

export default DiffExtendedModeToggle;
