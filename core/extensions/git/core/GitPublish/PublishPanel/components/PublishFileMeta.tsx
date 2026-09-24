import { cn } from "@core-ui/utils/cn";
import { formatBytes } from "@core-ui/utils/formatBytes";
import { useDiffExtendedMode } from "@ext/git/core/Diff/components/store/DiffExtendedModeStore";
import type { DiffFlattenTreeItem } from "@ext/git/core/GitDiffItemCreator/RevisionDiffPresenter";
import { FileStatus } from "@ext/Watchers/model/FileStatus";
import { Badge } from "@ui-kit/Badge";
import { tv } from "tailwind-variants";
import { PublishChangeCount } from "./PublishChangeCount";

type DiffEntryOverview = DiffFlattenTreeItem["overview"];

const sizeVariants = tv({
	base: "font-mono text-xs",
	variants: {
		status: {
			[FileStatus.new]: "text-[var(--color-status-new)]",
			[FileStatus.delete]: "text-[var(--color-status-deleted)]",
			[FileStatus.modified]: "text-[var(--color-status-modified)]",
			[FileStatus.rename]: "text-[var(--color-status-modified)]",
			[FileStatus.conflict]: "text-[var(--color-status-modified)]",
			[FileStatus.current]: "text-[var(--color-status-modified)]",
		},
	},
});

export type PublishFileMetaProps = {
	overview: DiffEntryOverview;
	className?: string;
};

export const PublishFileMeta = ({ overview, className }: PublishFileMetaProps) => {
	const extendedMode = useDiffExtendedMode();

	if (!overview.isLfs)
		return <PublishChangeCount added={overview.added} className={className} deleted={overview.removed} />;

	return (
		<span className={cn("flex shrink-0 items-center gap-1.5", className)}>
			{extendedMode && (
				<Badge className="border-transparent bg-primary-bg-hover text-primary-fg" size="sm">
					LFS
				</Badge>
			)}
			<span className={sizeVariants({ status: overview.status })}>{formatBytes(overview.size, 1)}</span>
		</span>
	);
};
