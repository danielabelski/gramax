import { usePlatform } from "@core-ui/hooks/usePlatform";
import { HISTORY_PANEL_ID } from "@ext/git/actions/Revisions/HistoryPanel/constants";
import { useIsRevision } from "@ext/git/actions/Revisions/logic/hooks/useIsRevision";
import t from "@ext/localization/locale/translate";
import { useIsStorageConnected } from "@ext/storage/logic/utils/useStorage";
import { usePanelToggle } from "@ui-kit/FloatingPanel";
import { GlassToolbarIcon, GlassToolbarToggleButton } from "@ui-kit/GlassToolbar";
import { Indicator } from "@ui-kit/Indicator";
import { useCallback, useRef } from "react";

interface HistoryButtonProps {
	onToggle?: () => void;
}

export const HistoryButton = ({ onToggle }: HistoryButtonProps) => {
	const { isNext } = usePlatform();
	const isStorageConnected = useIsStorageConnected();
	const triggerRef = useRef<HTMLButtonElement>(null);
	const { isOpen, toggle } = usePanelToggle(HISTORY_PANEL_ID, triggerRef);
	const isRevision = useIsRevision();

	const handleClick = useCallback(() => {
		toggle();
		onToggle?.();
	}, [toggle, onToggle]);

	if (isNext || !isStorageConnected) return null;

	return (
		<GlassToolbarToggleButton
			active={isOpen}
			onClick={handleClick}
			ref={triggerRef}
			tooltipText={t("git.history.name")}
		>
			<GlassToolbarIcon icon="history" />
			{isRevision && (
				<Indicator aria-hidden className="absolute right-0 top-0 size-2.5 rounded-full bg-status-error" />
			)}
		</GlassToolbarToggleButton>
	);
};
