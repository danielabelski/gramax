import PageDataContext from "@core-ui/ContextServices/PageDataContext";
import { useDiffStore } from "@core-ui/stores/DiffStore/DiffStore.provider";
import { useIsRevision } from "@ext/git/actions/Revisions/logic/hooks/useIsRevision";
import { useIsRevisionCompare } from "@ext/git/actions/Revisions/logic/hooks/useIsRevisionCompare";
import { ToolbarModesToggle } from "@ext/git/core/Diff/components/ToolbarModesToggle";
import { useDiffToggle } from "@ext/git/core/Diff/logic/hooks/useDiffToggle";
import { useIsDiffView } from "@ext/git/core/Diff/logic/hooks/useIsDiffView";
import t from "@ext/localization/locale/translate";
import { useIsStorageConnected } from "@ext/storage/logic/utils/useStorage";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@ui-kit/Dropdown";
import {
	GlassToolbarGroup,
	GlassToolbarIcon,
	GlassToolbarToggleButton,
	GlassToolbarTriggerChevron,
} from "@ui-kit/GlassToolbar";

export const ToolbarDiffToggle = () => {
	const isReadOnly = PageDataContext.value.conf.isReadOnly;
	const isDiffView = useIsDiffView();
	const isRevision = useIsRevision();
	const isRevisionCompare = useIsRevisionCompare();
	const toggleDiffMode = useDiffToggle();
	const diffEnabled = useDiffStore((state) => !!state?.diff);
	const isStorageConnected = useIsStorageConnected();

	if (!isStorageConnected) return null;

	return (
		<GlassToolbarGroup>
			<GlassToolbarToggleButton
				active={diffEnabled}
				data-testid="tb-diff-toggler"
				disabled={(!isRevision && !isDiffView && isReadOnly) || isRevisionCompare}
				onClick={toggleDiffMode}
				tooltipText={t("editor.diff")}
			>
				<GlassToolbarIcon icon="diff" />
			</GlassToolbarToggleButton>
			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<GlassToolbarTriggerChevron data-testid="tb-diff-sub" sub />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" side="top" sideOffset={8}>
					<ToolbarModesToggle />
				</DropdownMenuContent>
			</DropdownMenu>
		</GlassToolbarGroup>
	);
};
