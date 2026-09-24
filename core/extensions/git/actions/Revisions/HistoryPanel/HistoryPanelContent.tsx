import RevisionCommitsList from "@ext/git/actions/Revisions/components/RevisionsTab/Helpers/RevisionCommitsList";
import type { useRevisionsCatalogTab } from "@ext/git/actions/Revisions/logic/hooks/useRevisionsCatalogTab";
import { ComponentVariantProvider } from "@ui-kit/Providers";
import type { RefObject } from "react";

type HistoryPanelContentProps = ReturnType<typeof useRevisionsCatalogTab> & {
	anchorRef: RefObject<HTMLDivElement>;
};

export const HistoryPanelContent = ({
	anchorRef,
	revisions,
	reachedFirstCommit,
	requestMore,
	diffTree,
	isDiffTreeLoading,
	onRevisionClick,
	selectedCommitOid,
}: HistoryPanelContentProps) => {
	return (
		<ComponentVariantProvider variant="glass">
			<div className="flex h-full min-h-0 flex-1 flex-col" ref={anchorRef}>
				<RevisionCommitsList
					currentRevision={selectedCommitOid}
					diffTree={diffTree}
					isDiffTreeLoading={isDiffTreeLoading}
					onClick={onRevisionClick}
					requestMore={requestMore}
					revisions={revisions}
					shouldLoadMoreAtScrollEnd={!reachedFirstCommit}
				/>
			</div>
		</ComponentVariantProvider>
	);
};
