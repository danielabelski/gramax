import Date from "@components/Atoms/Date";
import { cn } from "@core-ui/utils/cn";
import BranchMenu from "@ext/git/actions/Branch/components/BranchMenu";
import type GitBranchData from "@ext/git/core/GitBranch/model/GitBranchData";
import t from "@ext/localization/locale/translate";
import { Badge } from "@ui-kit/Badge";
import { Icon } from "@ui-kit/Icon";
import { MenuItem, MenuItemIconButton } from "@ui-kit/MenuItem";
import { TextOverflowTooltip, Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";

type BranchRowProps = {
	branch: GitBranchData;
	currentBranchName: string;
	isCurrent?: boolean;
	showMenu?: boolean;
	onSelect?: () => void;
	onRefresh: () => void;
	onMergeRequestCreate?: () => void;
};

export const BranchRow = ({
	branch,
	currentBranchName,
	isCurrent,
	showMenu,
	onSelect,
	onRefresh,
	onMergeRequestCreate,
}: BranchRowProps) => (
	<MenuItem
		className={cn(
			"group/branch w-full min-w-0 items-center gap-2 bg-transparent rounded-lg px-3 py-2",
			"hover:bg-secondary-bg-hover data-[active=true]:bg-primary-bg-hover data-[active=true]:hover:bg-primary-bg-hover",
		)}
		data-active={isCurrent}
		data-branch-name={branch.name}
		data-testid="branch-row"
		onClick={isCurrent ? undefined : onSelect}
	>
		<div className="flex min-w-0 flex-1 flex-col">
			<div className="flex min-w-0 items-center gap-2">
				<TextOverflowTooltip className="font-medium text-xs">{branch.name}</TextOverflowTooltip>
				{!branch.remoteName && (
					<Tooltip>
						<TooltipTrigger asChild>
							<span>
								<Icon className="h-3.5 w-3.5 shrink-0 text-muted" icon="cloud-off" />
							</span>
						</TooltipTrigger>
						<TooltipContent>{t("local")}</TooltipContent>
					</Tooltip>
				)}
				{branch.mergeRequest && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Badge className="h-4 shrink-0 px-1.5" size="sm" status="warning">
								{t("git.merge-requests.branch-tab-badge")}
							</Badge>
						</TooltipTrigger>
						<TooltipContent>{t("git.merge-requests.branch-tab-tooltip")}</TooltipContent>
					</Tooltip>
				)}
			</div>
			<span className="flex min-w-0 items-center gap-1 text-muted text-xs font-normal">
				{branch.lastCommitAuthor && (
					<>
						<span className="truncate">{branch.lastCommitAuthor}</span>
						<span>·</span>
					</>
				)}
				<Date className="shrink-0" date={branch.lastCommitModify} />
			</span>
		</div>
		<div className="flex size-6 shrink-0 items-center justify-center">
			{!isCurrent && showMenu && (
				<div onClick={(event) => event.stopPropagation()}>
					<BranchMenu
						branchName={branch.name}
						currentBranchName={currentBranchName}
						onMergeRequestCreate={onMergeRequestCreate}
						refreshList={onRefresh}
						trigger={
							<MenuItemIconButton
								aria-label={`${t("git.branch.actions")}: ${branch.name}`}
								className="opacity-0 transition-opacity group-hover/branch:opacity-100 data-[state=open]:opacity-100"
								icon="ellipsis"
							/>
						}
					/>
				</div>
			)}
		</div>
	</MenuItem>
);
