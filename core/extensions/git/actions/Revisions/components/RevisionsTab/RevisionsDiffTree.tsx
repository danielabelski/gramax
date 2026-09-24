import { buildDiffTreeItems, type DiffTreeItem } from "@ext/git/core/Diff/components/Changes/diffTreeItems";
import { Overview } from "@ext/git/core/Diff/components/Changes/Overview";
import { useDiffExtendedMode } from "@ext/git/core/Diff/components/store/DiffExtendedModeStore";
import { isDiffEntryVisible } from "@ext/git/core/Diff/logic/utils/visibleDiffEntries";
import type { DiffFlattenTreeAnyItem } from "@ext/git/core/GitDiffItemCreator/RevisionDiffPresenter";
import t from "@ext/localization/locale/translate";
import CommentCount from "@ext/markdown/elements/comment/edit/components/CommentCount";
import { useGetTotalCommentsByPathname } from "@ext/markdown/elements/comment/edit/logic/stores/CommentsStore";
import { FileStatus } from "@ext/Watchers/model/FileStatus";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@ui-kit/Tooltip";
import {
	Tree,
	TreeIcon,
	TreeIndicator,
	TreeIndicatorBar,
	TreeMeta,
	TreeRow,
	TreeTitle,
	TreeTrailing,
} from "@ui-kit/Tree";
import { useMemo, useState } from "react";

const STATUS_LABELS = {
	[FileStatus.new]: "diff.type.added",
	[FileStatus.delete]: "diff.type.deleted",
	[FileStatus.modified]: "diff.type.modified",
	[FileStatus.rename]: "diff.type.breadcrumb",
} as const;

const REVISIONS_TREE_TITLE_OFFSET = 8;

type RevisionsDiffTreeProps = {
	entries: DiffFlattenTreeAnyItem[];
	onOpen: (entry: DiffFlattenTreeAnyItem) => void;
};

type RevisionsDiffTreeRowProps = {
	item: DiffTreeItem;
	depth: number;
	isActive: boolean;
	onOpen: (entry: DiffFlattenTreeAnyItem) => void;
};

const RevisionsDiffTreeRow = ({ item, depth, isActive, onOpen }: RevisionsDiffTreeRowProps) => {
	const isGroup = item.variant === "group";
	const entry = item.entry;
	const overview = entry.type === "node" ? null : entry.overview;
	const statusLabel = overview && STATUS_LABELS[overview.status];
	const pathname = entry.type === "item" ? entry.pathname : null;
	const commentsCount = useGetTotalCommentsByPathname(pathname);

	return (
		<TreeRow
			depth={depth}
			isActive={isActive}
			isGroup={isGroup}
			item={item}
			onClick={isGroup ? undefined : () => onOpen(entry)}
			titleOffset={REVISIONS_TREE_TITLE_OFFSET}
		>
			{item.accentColor && statusLabel && (
				<TreeIndicator>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<TreeIndicatorBar color={item.accentColor} />
							</TooltipTrigger>
							<TooltipContent side="right">{t(statusLabel)}</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</TreeIndicator>
			)}
			<TreeIcon icon={item.icon} />
			<TreeTitle>{item.title}</TreeTitle>
			{!isGroup && overview && (
				<TreeTrailing>
					<CommentCount className="ml-1" count={commentsCount} />
					<TreeMeta>
						<Overview {...overview} />
					</TreeMeta>
				</TreeTrailing>
			)}
		</TreeRow>
	);
};

export const RevisionsDiffTree = ({ entries, onOpen }: RevisionsDiffTreeProps) => {
	const [activePath, setActivePath] = useState<string>();
	const extendedMode = useDiffExtendedMode();
	const visibleEntries = useMemo(
		() => (entries ?? []).filter((entry) => isDiffEntryVisible(entry, extendedMode)),
		[entries, extendedMode],
	);
	const { items } = useMemo(() => buildDiffTreeItems(visibleEntries), [visibleEntries]);

	const handleOpen = (entry: DiffFlattenTreeAnyItem) => {
		if (entry.type === "node") return;
		setActivePath(entry.filepath.new);
		onOpen(entry);
	};

	return (
		<Tree className="px-2 py-1" items={items}>
			{({ item, depth }) => (
				<RevisionsDiffTreeRow depth={depth} isActive={item.id === activePath} item={item} onOpen={handleOpen} />
			)}
		</Tree>
	);
};
