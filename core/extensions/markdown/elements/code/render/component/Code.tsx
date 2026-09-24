import isNavigatorAvailable from "@core-ui/isNavigatorAvailable";
import { tryCopyToClipboard } from "@core-ui/utils/clipboard";
import { isTouchClick, keepTooltipOpen } from "@core-ui/utils/copyTooltip";
import t from "@ext/localization/locale/translate";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { type MouseEvent, useCallback, useState } from "react";

export default function Code({ children }: { children: string }) {
	const [isCopied, setIsCopied] = useState(false);
	const copyAllowed = isNavigatorAvailable();

	const onClickHandler = useCallback(
		(event: MouseEvent<HTMLSpanElement>) => {
			if (!copyAllowed) return;
			event.preventDefault();
			// On touch there is no tooltip to switch to "copied", so confirm with a popover.
			tryCopyToClipboard(children, { showPopover: isTouchClick(event) }).then((copied) => setIsCopied(copied));
		},
		[children, copyAllowed],
	);

	// The tooltip opens after a hover delay, so a quick click lands before it is shown.
	// Resetting on the way in instead of on open keeps that click's "copied" visible.
	const resetCopied = useCallback(() => setIsCopied(false), []);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span
					className="inline-code"
					onClick={onClickHandler}
					onPointerDown={keepTooltipOpen}
					onPointerEnter={resetCopied}
				>
					<code>{children}</code>
				</span>
			</TooltipTrigger>
			<TooltipContent onPointerDownOutside={(event) => event.preventDefault()}>
				{isCopied ? t("copied") : t("click-to-copy")}
			</TooltipContent>
		</Tooltip>
	);
}
