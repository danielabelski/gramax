import t from "@ext/localization/locale/translate";
import { FloatingIconButton } from "@ui-kit/FloatingPanel";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";

type InboxPanelActionsProps = {
	disabled: boolean;
	onAdd: () => void;
};

export const InboxPanelActions = ({ disabled, onAdd }: InboxPanelActionsProps) => (
	<Tooltip>
		<TooltipTrigger asChild>
			<FloatingIconButton disabled={disabled} icon="plus" onClick={onAdd} size="sm" variant="ghost" />
		</TooltipTrigger>
		<TooltipContent>{t("inbox.add-note")}</TooltipContent>
	</Tooltip>
);
