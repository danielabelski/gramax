import { cn } from "@core-ui/utils/cn";
import DateUtils from "@core-ui/utils/dateUtils";
import { useApproval } from "@ext/git/core/GitMergeRequest/components/Approval/useApproval";
import type { ApprovalSignature } from "@ext/git/core/GitMergeRequest/model/MergeRequest";
import t from "@ext/localization/locale/translate";
import { AvatarFallback, AvatarLabel, AvatarLabelAvatar, AvatarLabelTitle, getAvatarFallback } from "@ui-kit/Avatar";
import { Icon } from "@ui-kit/Icon";
import { MenuItemButton } from "@ui-kit/MenuItem";
import { TextOverflowTooltip, Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { TreeTrailing } from "@ui-kit/Tree";

const Approver = ({ approver, comments }: { approver: ApprovalSignature; comments: number }) => {
	const { setApprove, canSetApprove } = useApproval({ approver });
	const name = approver.name || approver.email || "Unknown";
	const isApproved = !!approver.approvedAt;
	const statusLabel = t(
		isApproved ? "git.merge-requests.approval.approved" : "git.merge-requests.approval.unapproved",
	);

	return (
		<MenuItemButton
			className={cn(
				"py-1 w-full min-w-0 rounded-lg bg-transparent pr-2 transition-none px-1.5 h-auto",
				canSetApprove && "cursor-pointer lg:hover:bg-primary-bg-hover focus:bg-primary-bg-hover",
				!canSetApprove && "cursor-default lg:hover:bg-transparent focus:bg-transparent",
			)}
			containerClassName="w-full min-w-0 justify-start"
			data-qa={canSetApprove ? "qa-clickable" : undefined}
			onClick={canSetApprove ? () => setApprove(!approver.approvedAt) : undefined}
		>
			<AvatarLabel className="min-w-0 flex-1" size="2xs">
				<AvatarLabelAvatar>
					<AvatarFallback uniqueId={approver.email ?? name}>{getAvatarFallback(name)}</AvatarFallback>
				</AvatarLabelAvatar>
				<AvatarLabelTitle className="min-w-0 font-medium">
					<TextOverflowTooltip className="block text-sm">
						{name}
						{canSetApprove && (
							<span className="ml-1 font-normal text-muted">({t("git.merge-requests.you")})</span>
						)}
					</TextOverflowTooltip>
				</AvatarLabelTitle>
			</AvatarLabel>

			<TreeTrailing className="gap-2">
				{comments > 0 && (
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="flex shrink-0 items-center gap-0.5 text-xs text-muted">
								<Icon className="size-3.5" icon="message-square" />
								{comments}
							</span>
						</TooltipTrigger>
						<TooltipContent>{t("numbero-of-unsolved-comments")}</TooltipContent>
					</Tooltip>
				)}

				<Tooltip>
					<TooltipTrigger asChild>
						<span
							aria-label={statusLabel}
							className={cn("shrink-0", isApproved && "text-status-success", !isApproved && "text-muted")}
							role="img"
						>
							<Icon className="size-5" icon={isApproved ? "circle-check" : "circle-dashed"} />
						</span>
					</TooltipTrigger>
					<TooltipContent>
						<span className="flex items-center gap-1">
							{statusLabel}
							{approver.approvedAt && <span>{DateUtils.getRelativeDateTime(approver.approvedAt)}</span>}
						</span>
					</TooltipContent>
				</Tooltip>
			</TreeTrailing>
		</MenuItemButton>
	);
};

export default Approver;
