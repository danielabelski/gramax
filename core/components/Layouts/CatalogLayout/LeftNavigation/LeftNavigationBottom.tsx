import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import { useCatalogPropsStore } from "@core-ui/stores/CatalogPropsStore/CatalogPropsStore.provider";
import ConnectStorage from "@ext/catalog/actions/ConnectStorage";
import useIsOffline from "@ext/errorHandlers/hooks/useIsOffline";
import RepositoryBroken from "@ext/git/actions/RepositoryBroken";
import getCommitOidFromPathname from "@ext/git/actions/Revisions/logic/utils/getCommitOidFromPathname";
import Sync from "@ext/git/actions/Sync/components/Sync";
import t from "@ext/localization/locale/translate";
import { useIsStorageConnected } from "@ext/storage/logic/utils/useStorage";
import {
	GlassToolbar,
	GlassToolbarButton,
	GlassToolbarIcon,
	GlassToolbarSeparator,
	GlassToolbarText,
} from "@ui-kit/GlassToolbar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@ui-kit/Tooltip";
import { OfflineButton } from "./OfflineButton";
import PublishButton from "./PublishButton";

const LeftNavigationBottom = () => {
	const isOffline = useIsOffline();
	const { isNext } = usePlatform();
	const { isReadOnly } = PageDataContextService.value.conf;
	const isStorageConnected = useIsStorageConnected();
	const { catalogName, repositoryError } = useCatalogPropsStore(
		(state) => ({ catalogName: state.data?.name, repositoryError: state.data?.repositoryError }),
		"shallow",
	);
	const isRevision = !!getCommitOidFromPathname(catalogName);
	const isPublishDisabled = isOffline || (!isNext && isReadOnly);
	const publishDisabledReason = isRevision ? t("git.publish.error.at-revision") : t("git.publish.error.main-branch");
	const actionsToolbar = (
		<GlassToolbar className="w-fit pr-1">
			<Sync disable={isOffline} />
			{!isNext && (
				<>
					<GlassToolbarSeparator />
					<PublishButton
						disable={isPublishDisabled}
						disabledReason={!isNext && isReadOnly ? publishDisabledReason : undefined}
					/>
				</>
			)}
		</GlassToolbar>
	);

	return (
		<div className="flex items-center gap-2" data-qa="qa-status-bar" data-testid="left-navigation-bottom">
			{!isStorageConnected ? (
				<GlassToolbar className="w-fit px-1">
					<ConnectStorage
						trigger={
							<GlassToolbarButton data-qa="qa-connect-storage" focusable>
								<GlassToolbarIcon icon="cloud-off" />
								<GlassToolbarText className="text-xs font-medium">
									{t("connect-storage")}
								</GlassToolbarText>
							</GlassToolbarButton>
						}
					/>
				</GlassToolbar>
			) : repositoryError ? (
				<GlassToolbar className="w-fit px-1">
					<RepositoryBroken
						error={repositoryError}
						trigger={
							<GlassToolbarButton aria-label={t("git.error.broken.tooltip")} focusable>
								<GlassToolbarIcon icon="cloud-alert" />
							</GlassToolbarButton>
						}
					/>
				</GlassToolbar>
			) : isRevision ? (
				<Tooltip>
					<TooltipTrigger asChild>{actionsToolbar}</TooltipTrigger>
					<TooltipContent>{t("git.sync.error.at-revision")}</TooltipContent>
				</Tooltip>
			) : (
				actionsToolbar
			)}
			{isOffline && !isNext && (
				<GlassToolbar variant="single">
					<OfflineButton />
				</GlassToolbar>
			)}
		</div>
	);
};
export default LeftNavigationBottom;
