import type GitBranchData from "@ext/git/core/GitBranch/model/GitBranchData";
import t from "@ext/localization/locale/translate";
import { useVirtualizer } from "@tanstack/react-virtual";
import { EmptyState } from "@ui-kit/EmptyState";
import { ScrollShadowContainer } from "@ui-kit/ScrollShadowContainer";
import { useRef } from "react";
import { BRANCH_ROW_ESTIMATED_HEIGHT } from "../constants";
import { BranchRow } from "./BranchRow";

type BranchListProps = {
	branches: GitBranchData[];
	currentBranchName: string;
	showMenu: boolean;
	onSelect: (branchName: string) => void;
	onRefresh: () => void;
	onMergeRequestCreate: () => void;
};

export const BranchList = ({
	branches,
	currentBranchName,
	showMenu,
	onSelect,
	onRefresh,
	onMergeRequestCreate,
}: BranchListProps) => {
	const scrollRef = useRef<HTMLDivElement>(null);

	const virtualizer = useVirtualizer({
		count: branches.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => BRANCH_ROW_ESTIMATED_HEIGHT,
		overscan: 10,
		getItemKey: (index) => branches[index].name,
	});

	if (!branches.length) return <EmptyState>{t("no-branch-found")}</EmptyState>;

	return (
		<ScrollShadowContainer className="mt-2 flex min-h-0 flex-1 flex-col" ref={scrollRef}>
			<div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
				{virtualizer.getVirtualItems().map((virtualRow) => {
					const branch = branches[virtualRow.index];

					return (
						<div
							className="absolute top-0 left-0 w-full"
							data-index={virtualRow.index}
							key={virtualRow.key}
							ref={virtualizer.measureElement}
							style={{ transform: `translateY(${virtualRow.start}px)` }}
						>
							<BranchRow
								branch={branch}
								currentBranchName={currentBranchName}
								isCurrent={branch.name === currentBranchName}
								onMergeRequestCreate={onMergeRequestCreate}
								onRefresh={onRefresh}
								onSelect={() => onSelect(branch.name)}
								showMenu={showMenu}
							/>
						</div>
					);
				})}
			</div>
		</ScrollShadowContainer>
	);
};
