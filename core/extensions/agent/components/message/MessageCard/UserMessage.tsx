import { tryCopyToClipboard } from "@core-ui/utils/clipboard";
import { cn } from "@core-ui/utils/cn";
import type { AgentAttachment } from "@ext/agent/core/attachmentStore";
import t from "@ext/localization/locale/translate";
import { IconButton } from "@ui-kit/Button";
import { Icon } from "@ui-kit/Icon";
import { Tag } from "@ui-kit/Tag";
import { OverflowTooltip, Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { type Ref, useEffect, useState } from "react";

export interface UserMessageProps {
	userText: string;
	attachments?: AgentAttachment[];
	quotedText?: string;
	stickyUserPrompt?: boolean;
	userPromptAnchorRef?: Ref<HTMLDivElement>;
}

export const UserMessage = ({
	userText,
	attachments,
	quotedText,
	stickyUserPrompt = false,
	userPromptAnchorRef,
}: UserMessageProps) => {
	const [isCopied, setIsCopied] = useState(false);

	useEffect(() => {
		if (!isCopied) return undefined;

		const timeoutId = setTimeout(() => {
			setIsCopied(false);
		}, 1200);

		return () => {
			clearTimeout(timeoutId);
		};
	}, [isCopied]);

	const handleCopy = () => {
		void tryCopyToClipboard(userText, { showPopover: false }).then((copied) => {
			if (copied) setIsCopied(true);
		});
	};

	return (
		<div
			className={cn(
				"group w-full min-w-0 pt-3 pb-2",
				stickyUserPrompt && cn("top-0 transition-[padding] duration-200 ease-out"),
			)}
			ref={userPromptAnchorRef}
		>
			{quotedText && (
				<div className="flex justify-end">
					<div className="flex max-w-[85%] min-w-0 items-center gap-1 pb-1 pr-1">
						<Icon className="size-3.5 shrink-0 text-muted-foreground" icon="corner-down-right" />
						<OverflowTooltip className="truncate min-w-0 text-sm text-muted-foreground">
							{quotedText}
						</OverflowTooltip>
					</div>
				</div>
			)}
			<div className="flex items-start justify-end gap-1">
				<div className="flex shrink-0 items-end justify-start pb-1 pt-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<IconButton
								className={cn(
									"opacity-0 transition-all duration-150",
									"group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
									isCopied && "opacity-100",
								)}
								icon={isCopied ? "Check" : "Copy"}
								onClick={handleCopy}
								size="xs"
								variant="ghost"
							/>
						</TooltipTrigger>
						<TooltipContent>{t("copy")}</TooltipContent>
					</Tooltip>
				</div>
				<div className="flex max-w-[85%] min-w-0 flex-col items-stretch gap-1 rounded-xl rounded-br-[2px] border-secondary-border border-[0.5px] bg-background py-2 pl-3 pr-2.5">
					{attachments && attachments.length > 0 && (
						<div className="flex flex-wrap gap-1.5 pt-1">
							{attachments.map((attachment) => (
								<Tag
									buttonClassName="hover:bg-status-neutral-bg cursor-default min-w-0 max-w-full overflow-hidden !shadow-none shadow-soft-none hover:!shadow-none hover:shadow-soft-none active:!shadow-none active:shadow-soft-none focus:!shadow-none focus:shadow-soft-none"
									className="min-w-0 max-w-full"
									containerClassName="w-auto min-w-0 max-w-full"
									key={attachment.storagePath}
									size="sm"
									startIcon="paperclip"
								>
									<OverflowTooltip className="truncate h-5 py-1 min-w-0">
										{attachment.originalFilename}
									</OverflowTooltip>
								</Tag>
							))}
						</div>
					)}
					<div className="min-w-0 flex-1 text-sm text-primary-fg" data-agent-quotable>
						<span className="whitespace-pre-line break-words">{userText}</span>
					</div>
				</div>
			</div>
		</div>
	);
};
