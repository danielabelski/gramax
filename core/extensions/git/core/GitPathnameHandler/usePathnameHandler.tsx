import ArticleUpdaterService from "@components/Article/ArticleUpdater/ArticleUpdaterService";
import { useRouter } from "@core/Api/useRouter";
import Path from "@core/FileProvider/Path/Path";
import RouterPathProvider from "@core/RouterPath/RouterPathProvider";
import FetchService from "@core-ui/ApiServices/FetchService";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import SyncIconService from "@core-ui/ContextServices/SyncIconService";
import ArticleViewService from "@core-ui/ContextServices/views/articleView/ArticleViewService";
import useWatch from "@core-ui/hooks/useWatch";
import tryOpenMergeConflict from "@ext/git/actions/MergeConflictHandler/logic/tryOpenMergeConflict";
import type MergeData from "@ext/git/actions/MergeConflictHandler/model/MergeData";
import { useIsRevision } from "@ext/git/actions/Revisions/logic/hooks/useIsRevision";
import SyncService from "@ext/git/actions/Sync/logic/SyncService";
import type CheckoutHandler from "@ext/git/core/GitPathnameHandler/checkout/components/CheckoutHandler";
import getPathnameCheckoutData from "@ext/git/core/GitPathnameHandler/checkout/logic/getPathnameCheckoutData";
import useOnPathnameUpdateBranch from "@ext/git/core/GitPathnameHandler/checkout/logic/useOnPathnameUpdateBranch";
import type PullHandler from "@ext/git/core/GitPathnameHandler/pull/components/PullHandler";
import getPathnamePullData from "@ext/git/core/GitPathnameHandler/pull/logic/getPathnamePullData";
import t from "@ext/localization/locale/translate";
import { traced } from "@ext/loggers/opentelemetry";
import useIsSourceDataValid from "@ext/storage/components/useIsSourceDataValid";
import { useIsRepoOk } from "@ext/storage/logic/utils/useStorage";
import { type ComponentProps, useEffect, useRef } from "react";

const usePathnameHandler = (isFirstLoad: boolean) => {
	const router = useRouter();
	const apiUrlCreator = ApiUrlCreatorService.value;
	const isRepoOk = useIsRepoOk();
	const isRevision = useIsRevision();
	const isSourceValid = useIsSourceDataValid();
	const pageDataContext = PageDataContextService.value;
	const { isArticle } = pageDataContext;
	const haveBeenFirstLoad = useRef(false);

	useOnPathnameUpdateBranch();

	useWatch(() => {
		if (isFirstLoad) haveBeenFirstLoad.current = true;
	}, [isFirstLoad]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: expected
	useEffect(() => {
		if (!isArticle || !isRepoOk || !haveBeenFirstLoad.current) return;

		const isEditorPathname = RouterPathProvider.isEditorPathname(router.path);
		if (!isEditorPathname) return;

		const routerPath = new Path(router.path + router.hash).removeExtraSymbols;

		haveBeenFirstLoad.current = false;

		const handler = async () => {
			if (isRevision) return;
			const res = await FetchService.fetch<MergeData>(apiUrlCreator.getMergeData());
			if (!res.ok) return;
			const mergeData = await res.json();

			const pathnameData = RouterPathProvider.parsePath(routerPath);
			const checkoutData = await getPathnameCheckoutData(apiUrlCreator, pathnameData.refname);

			// restore branch to current branch in router
			if (checkoutData.haveToCheckout) {
				const newPath = RouterPathProvider.updatePathnameData(pathnameData, {
					refname: checkoutData.currentBranch,
				}).value;

				router.pushPath(newPath);
			}

			if (mergeData?.stashRestored) {
				await ArticleUpdaterService.update(apiUrlCreator);
				await refreshPage();
				return;
			}

			if (!mergeData?.ok) {
				tryOpenMergeConflict({
					mergeData,
					errorText: checkoutData.haveToCheckout
						? t("git.merge.confirm.catalog-conflict-state-with-checkout").replace(
								"{{branchToCheckout}}",
								checkoutData.branchToCheckout,
							)
						: t("git.merge.confirm.catalog-conflict-state"),
					title: t("git.merge.error.catalog-conflict-state"),
				});
				return;
			}

			if (checkoutData.haveToCheckout) {
				ModalToOpenService.setValue<ComponentProps<typeof CheckoutHandler>>(ModalToOpen.CheckoutHandler, {
					catalogName: pathnameData.catalogName,
					currentBranchName: checkoutData.currentBranch,
					branchToCheckout: checkoutData.branchToCheckout,
				});

				return;
			}

			if (!isSourceValid) return;

			SyncIconService.start();
			const { haveToPull, canPull } = await getPathnamePullData(apiUrlCreator);

			if (!haveToPull) return;

			if (canPull) {
				await SyncService.sync(apiUrlCreator);
				return;
			}

			ModalToOpenService.setValue<ComponentProps<typeof PullHandler>>(ModalToOpen.PullHandler);
		};

		// Cleanup belongs in finally: sync, conflict and error paths finish through different returns,
		// and thrown errors do not emit a page update event.
		void traced("git-pathname-handler", async () => {
			try {
				await handler();
			} finally {
				SyncIconService.stop();
				ArticleViewService.setDefaultView();
			}
		});
	}, [router.path, router.hash, isFirstLoad, isArticle, isRepoOk, isSourceValid, apiUrlCreator, isRevision]);
};

export default usePathnameHandler;
