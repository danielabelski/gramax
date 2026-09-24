import { TooltipIconButton } from "@components/Atoms/TooltipIconButton";
import { DiffStatusIndicator } from "@ext/git/core/Diff/components/Changes/DiffStatusIndicator";
import type { DiffTreeItem } from "@ext/git/core/Diff/components/Changes/diffTreeItems";
import type { DiffFlattenTreeAnyItem } from "@ext/git/core/GitDiffItemCreator/RevisionDiffPresenter";
import t from "@ext/localization/locale/translate";
import { TreeActions, TreeCheckbox, TreeIcon, TreeMeta, TreeRow, TreeTitle, TreeTrailing } from "@ui-kit/Tree";
import { PUBLISH_TREE_TITLE_OFFSET } from "../constants";
import { PublishFileMeta } from "./PublishFileMeta";

export type PublishTreeRowProps = {
	item: DiffTreeItem;
	depth: number;
	isActive: boolean;
	canDiscard: boolean;
	isSelected: (entry: DiffFlattenTreeAnyItem) => boolean;
	onSelect: (entry: DiffFlattenTreeAnyItem, checked: boolean) => void;
	onOpen: (entry: DiffFlattenTreeAnyItem) => void;
	onDiscard: (entry: DiffFlattenTreeAnyItem) => void;
};

export const PublishTreeRow = ({
	item,
	depth,
	isActive,
	canDiscard,
	isSelected,
	onSelect,
	onOpen,
	onDiscard,
}: PublishTreeRowProps) => {
	const isGroup = item.variant === "group";
	const overview = item.entry.type === "node" ? null : item.entry.overview;

	return (
		<TreeRow
			depth={depth}
			isActive={isActive}
			isGroup={isGroup}
			isSelected={isGroup ? undefined : isSelected(item.entry)}
			item={item}
			onClick={isGroup ? undefined : () => onOpen(item.entry)}
			onSelect={isGroup ? undefined : (checked) => onSelect(item.entry, checked)}
			titleOffset={PUBLISH_TREE_TITLE_OFFSET}
		>
			{item.accentColor && overview && <DiffStatusIndicator color={item.accentColor} status={overview.status} />}
			<TreeCheckbox />
			<TreeIcon icon={item.icon} />
			<TreeTitle>{item.title}</TreeTitle>
			{!isGroup && (
				<TreeTrailing>
					{overview && (
						<TreeMeta>
							<PublishFileMeta overview={overview} />
						</TreeMeta>
					)}
					{canDiscard && (
						<TreeActions>
							<TooltipIconButton
								className="shrink-0 h-auto p-0"
								icon="reply"
								onClick={(event) => {
									event.stopPropagation();
									onDiscard(item.entry);
								}}
								size="sm"
								tooltip={t("git.discard.selected-file-arrow-tooltip")}
								variant="text"
							/>
						</TreeActions>
					)}
				</TreeTrailing>
			)}
		</TreeRow>
	);
};
