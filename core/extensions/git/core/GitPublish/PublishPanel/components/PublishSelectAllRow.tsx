import { TooltipIconButton } from "@components/Atoms/TooltipIconButton";
import type { TotalOverview } from "@ext/git/core/GitDiffItemCreator/RevisionDiffPresenter";
import t from "@ext/localization/locale/translate";
import { TreeActions, TreeCheckbox, TreeMeta, TreeRow, TreeTitle, TreeTrailing } from "@ui-kit/Tree";
import { PUBLISH_TREE_TITLE_OFFSET } from "../constants";
import { PublishChangeCount } from "./PublishChangeCount";

export type PublishSelectAllRowProps = {
	isSelectedAll: boolean;
	overview: TotalOverview;
	canDiscard: boolean;
	onSelectAll: (checked: boolean) => void;
	onDiscardAll: () => void;
};

export const PublishSelectAllRow = ({
	isSelectedAll,
	overview,
	canDiscard,
	onSelectAll,
	onDiscardAll,
}: PublishSelectAllRowProps) => {
	return (
		<TreeRow
			depth={0}
			isActive={false}
			isSelected={isSelectedAll}
			item={{ id: "select-all" }}
			onClick={() => onSelectAll(!isSelectedAll)}
			onSelect={onSelectAll}
			titleOffset={PUBLISH_TREE_TITLE_OFFSET}
		>
			<TreeCheckbox />
			<TreeTitle className="text-muted">{t("properties.select-all")}</TreeTitle>
			<TreeTrailing>
				<TreeMeta>
					<PublishChangeCount
						added={overview?.added}
						deleted={overview?.deleted}
						modified={overview?.modified}
						showTotal
					/>
				</TreeMeta>
				{canDiscard && (
					<TreeActions>
						<TooltipIconButton
							className="shrink-0"
							icon="reply-all"
							onClick={(event) => {
								event.stopPropagation();
								onDiscardAll();
							}}
							size="sm"
							tooltip={t("git.discard.select-all-arrow-tooltip")}
							variant="text"
						/>
					</TreeActions>
				)}
			</TreeTrailing>
		</TreeRow>
	);
};
