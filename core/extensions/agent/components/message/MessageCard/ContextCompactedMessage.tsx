import t from "@ext/localization/locale/translate";
import { Icon } from "@ui-kit/Icon";
import { TextOverflowTooltip } from "@ui-kit/Tooltip";
import type { Ref } from "react";

export const ContextCompactedMessage = ({ responseRef }: { responseRef?: Ref<HTMLDivElement> }) => {
	return (
		<div className="flex w-full min-w-0 items-center gap-2 rounded py-0.5 text-left" ref={responseRef}>
			<Icon className="size-3.5 shrink-0 text-muted-foreground" icon="package" />
			<TextOverflowTooltip className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
				{t("agent.context-compacted")}
			</TextOverflowTooltip>
		</div>
	);
};
