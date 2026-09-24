import t from "@ext/localization/locale/translate";
import { IconButton } from "@ui-kit/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";

export const RefreshDataButton = ({ handleRefresh }: { handleRefresh: () => void }) => {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<IconButton icon="refresh-cw" onClick={handleRefresh} variant="outline" />
			</TooltipTrigger>
			<TooltipContent>{t("refresh")}</TooltipContent>
		</Tooltip>
	);
};
