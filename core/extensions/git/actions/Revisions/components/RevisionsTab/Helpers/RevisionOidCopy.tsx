import isNavigatorAvailable from "@core-ui/isNavigatorAvailable";
import { tryCopyToClipboard } from "@core-ui/utils/clipboard";
import { isTouchClick, keepTooltipOpen } from "@core-ui/utils/copyTooltip";
import t from "@ext/localization/locale/translate";
import { Button } from "@ui-kit/Button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { type MouseEvent, useCallback, useState } from "react";

interface RevisionOidCopyProps {
	children: string;
	value?: string;
	className?: string;
}

const RevisionOidCopy = ({ children, value }: RevisionOidCopyProps) => {
	const [isCopied, setIsCopied] = useState(false);
	const copyAllowed = isNavigatorAvailable();

	const onClickHandler = useCallback(
		(event: MouseEvent<HTMLSpanElement>) => {
			if (!copyAllowed) return;
			event.preventDefault();
			// On touch there is no tooltip to switch to "copied", so confirm with a popover.
			tryCopyToClipboard(value ?? children, { showPopover: isTouchClick(event) }).then((copied) =>
				setIsCopied(copied),
			);
		},
		[children, value, copyAllowed],
	);

	// The tooltip opens after a hover delay, so a quick click lands before it is shown.
	// Resetting on the way in instead of on open keeps that click's "copied" visible. Focus counts as
	// a way in too: without it a keyboard user who tabs back reads a stale "copied".
	const resetCopied = useCallback(() => setIsCopied(false), []);

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					className="h-auto p-0 rounded-none shrink-0 font-normal"
					onClick={onClickHandler}
					onFocus={resetCopied}
					onPointerDown={keepTooltipOpen}
					onPointerEnter={resetCopied}
					size="xs"
					variant="text"
				>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent onPointerDownOutside={(event) => event.preventDefault()}>
				{isCopied ? t("copied") : t("click-to-copy")}
			</TooltipContent>
		</Tooltip>
	);
};

export default RevisionOidCopy;
