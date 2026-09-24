import isNavigatorAvailable from "@core-ui/isNavigatorAvailable";
import { tryCopyToClipboard } from "@core-ui/utils/clipboard";
import { cn } from "@core-ui/utils/cn";
import { isTouchClick, keepTooltipOpen } from "@core-ui/utils/copyTooltip";
import t from "@ext/localization/locale/translate";
import { IconButton } from "@ui-kit/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { type MouseEvent, useCallback, useState } from "react";

export interface CopyAnswerButtonProps {
	text: string;
}

export const CopyAnswerButton = ({ text }: CopyAnswerButtonProps) => {
	const [isCopied, setIsCopied] = useState(false);
	const copyAllowed = isNavigatorAvailable();

	const onClickHandler = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			if (!copyAllowed) return;
			event.preventDefault();
			// On touch there is no tooltip to switch to "copied", so confirm with a popover.
			tryCopyToClipboard(text, { showPopover: isTouchClick(event) }).then((copied) => setIsCopied(copied));
		},
		[text, copyAllowed],
	);

	// The tooltip opens after a hover delay, so a quick click lands before it is shown.
	// Resetting on the way in instead of on open keeps that click's "copied" visible. Focus counts as
	// a way in too: without it a keyboard user who tabs back reads a stale "copied".
	const resetCopied = useCallback(() => setIsCopied(false), []);

	return (
		<div className="flex">
			<Tooltip>
				<TooltipTrigger asChild>
					<IconButton
						className={cn(
							"opacity-60 transition-all duration-150",
							"hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
							isCopied && "opacity-100",
						)}
						icon={isCopied ? "Check" : "Copy"}
						onClick={onClickHandler}
						onFocus={resetCopied}
						onPointerDown={keepTooltipOpen}
						onPointerEnter={resetCopied}
						size="xs"
						variant="ghost"
					/>
				</TooltipTrigger>
				<TooltipContent>{isCopied ? t("copied") : t("click-to-copy")}</TooltipContent>
			</Tooltip>
		</div>
	);
};
