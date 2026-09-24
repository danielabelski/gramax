import useSetArticleDiffView from "@core-ui/hooks/diff/useSetArticleDiffView";
import { useDiffExtendedMode } from "@ext/git/core/Diff/components/store/DiffExtendedModeStore";
import { useDiffEntries } from "@ext/git/core/Diff/logic/hooks/useDiffEntries";
import { isDiffEntryVisible } from "@ext/git/core/Diff/logic/utils/visibleDiffEntries";
import type { TreeReadScope } from "@ext/git/core/GitCommands/model/GitCommandsModel";
import type { DiffFlattenTreeAnyItem } from "@ext/git/core/GitDiffItemCreator/RevisionDiffPresenter";
import { PublishChangeCount } from "@ext/git/core/GitPublish/PublishPanel/components/PublishChangeCount";
import t from "@ext/localization/locale/translate";
import { PanelLoader } from "@ui-kit/FloatingPanel";
import { ScrollShadowContainer } from "@ui-kit/ScrollShadowContainer";
import { useEffect, useMemo, useState } from "react";
import { MergeRequestTree } from "./MergeRequestTree";

export const MergeRequestChanges = ({
	targetRef,
	onPathnamesChange,
}: {
	targetRef: string;
	onPathnamesChange: (pathnames: string[]) => void;
}) => {
	const { changes } = useDiffEntries();
	const extendedMode = useDiffExtendedMode();
	const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
	const mergeBase = changes?.mergeBase;
	const deleteScope = useMemo<TreeReadScope>(
		() => (mergeBase ? { commit: mergeBase } : { reference: targetRef }),
		[mergeBase, targetRef],
	);
	const openDiff = useSetArticleDiffView(null, deleteScope);
	const entries = useMemo(
		() => (changes?.data ?? []).filter((entry) => isDiffEntryVisible(entry, extendedMode)),
		[changes?.data, extendedMode],
	);

	useEffect(() => {
		onPathnamesChange(
			(changes?.data ?? []).reduce<string[]>((pathnames, entry) => {
				if (entry.type === "item") pathnames.push(entry.pathname);
				return pathnames;
			}, []),
		);
	}, [changes?.data, onPathnamesChange]);

	if (!changes) return <PanelLoader size="md">{t("loading")}</PanelLoader>;

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-1">
			<div className="flex py-1.5 shrink-0 items-center justify-between px-4 text-xs text-muted font-medium">
				<span>{t("git.merge-requests.diff")}</span>
				<PublishChangeCount
					added={changes.overview?.added}
					deleted={changes.overview?.deleted}
					modified={changes.overview?.modified}
					showTotal
				/>
			</div>
			<ScrollShadowContainer className="min-h-0 flex-1 px-2" ref={setScrollElement}>
				<MergeRequestTree
					entries={entries}
					onOpen={(entry: DiffFlattenTreeAnyItem) => openDiff(entry)}
					scrollElement={scrollElement}
				/>
			</ScrollShadowContainer>
		</div>
	);
};
