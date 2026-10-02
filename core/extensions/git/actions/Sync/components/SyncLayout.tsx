import PullPushCounter from "@ext/git/actions/Sync/components/PullPushCounter";
import t, { pluralize } from "@ext/localization/locale/translate";
import { GlassToolbarButton, GlassToolbarText } from "@ui-kit/GlassToolbar";
import { Icon } from "@ui-kit/Icon";
import type { CSSProperties } from "react";

interface SyncLayoutProps {
	pullCounter: number;
	pushCounter: number;
	sourceInvalid: boolean;
	syncProccess: boolean;
	style?: CSSProperties;
	disabled?: boolean;
	onClick?: () => void;
}

const SyncLayout = (props: SyncLayoutProps) => {
	const { pullCounter, pushCounter, sourceInvalid, syncProccess, onClick, style, disabled } = props;

	const changesTooltip = [
		pullCounter > 0 &&
			pluralize(pullCounter, {
				one: t("sync-catalog-changed1"),
				few: t("sync-catalog-changed2"),
				many: t("sync-catalog-changed3"),
			}),
		pushCounter > 0 &&
			pluralize(pushCounter, {
				one: t("sync-catalog-push1"),
				few: t("sync-catalog-push2"),
				many: t("sync-catalog-push3"),
			}),
	]
		.filter(Boolean)
		.join("; ");
	const ok = syncProccess ? t("synchronization") : changesTooltip || `${t("sync")} ${t("catalog.name")}`;
	const err = t("storage-not-connected");

	return (
		<GlassToolbarButton
			aria-busy={syncProccess}
			aria-label={t("sync")}
			className="sync-icons"
			data-testid="sync-trigger"
			disabled={disabled}
			onClick={onClick}
			style={style}
			tooltipText={sourceInvalid ? err : ok}
		>
			<Icon icon={syncProccess ? "refresh-cw-animated" : "refresh-cw"} />
			{sourceInvalid && <GlassToolbarText className="text-xs font-medium">!</GlassToolbarText>}
			<PullPushCounter pullCounter={pullCounter} pushCounter={pushCounter} />
		</GlassToolbarButton>
	);
};
export default SyncLayout;
