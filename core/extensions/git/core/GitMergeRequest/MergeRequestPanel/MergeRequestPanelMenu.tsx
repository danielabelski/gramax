import { useDiffExtendedMode, useSetDiffExtendedMode } from "@ext/git/core/Diff/components/store/DiffExtendedModeStore";
import t from "@ext/localization/locale/translate";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@ui-kit/Dropdown";
import { FloatingTriggerButton } from "@ui-kit/FloatingPanel";
import { Icon } from "@ui-kit/Icon";
import { Switch } from "@ui-kit/Switch";

export const MergeRequestPanelMenu = ({ onDelete }: { onDelete: () => void }) => {
	const extendedMode = useDiffExtendedMode();
	const setDiffExtendedMode = useSetDiffExtendedMode();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<FloatingTriggerButton size="xs">
					<Icon className="size-3.5" icon="ellipsis" />
				</FloatingTriggerButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem
					onClick={(event) => event.preventDefault()}
					onSelect={() => setDiffExtendedMode(!extendedMode)}
				>
					<span className="flex flex-1 items-center justify-between gap-4">
						{t("git.merge-requests.advanced-mode")}
						<Switch checked={extendedMode} onCheckedChange={setDiffExtendedMode} size="xs" />
					</span>
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={onDelete} type="danger">
					<Icon icon="trash" />
					{t("delete")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
