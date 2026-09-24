import { useRouter } from "@core/Api/useRouter";
import RouterPathProvider from "@core/RouterPath/RouterPathProvider";
import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { useCloneRepo } from "@ext/git/actions/Clone/logic/useCloneRepo";
import type CloneHandler from "@ext/git/core/GitPathnameHandler/clone/components/CloneHandler";
import getUrlFromShareData from "@ext/git/core/GitPathnameHandler/clone/logic/getUrlFromShareData";
import type GitShareData from "@ext/git/core/model/GitShareData";
import type { PublicGitStorageData } from "@ext/git/core/model/GitStorageData";
import SourceType from "@ext/storage/logic/SourceDataProvider/model/SourceType";
import { type ComponentProps, useCallback, useEffect } from "react";

const useClonePublic = () => {
	const router = useRouter();
	const pageDataContext = PageDataContextService.value;
	const { isReadOnly } = pageDataContext.conf;

	const { startClone } = useCloneRepo({
		skipCheck: true,
		onStart: () => {
			router.pushPath("/");
		},
	});

	return useCallback(
		async (shareData: GitShareData) => {
			if (!shareData || isReadOnly || !shareData.domain || !shareData.group || !shareData.name) return;

			const url = getUrlFromShareData(shareData);

			const redirect = RouterPathProvider.getPathname({
				catalogName: shareData.name,
				filePath: shareData.filePath,
			}).toString();

			const storageData: PublicGitStorageData = {
				name: shareData.name,
				url,
				source: {
					sourceType: SourceType.git,
					userName: "git",
					userEmail: "",
				},
			};

			return await startClone({ storageData, branch: shareData.branch, redirectOnClone: redirect });
		},
		[startClone, isReadOnly],
	);
};

const usePathnameCloneHandler = () => {
	const router = useRouter();
	const pageDataContext = PageDataContextService.value;
	const startClonePublic = useClonePublic();
	const { isReadOnly } = pageDataContext.conf;
	const { shareData } = pageDataContext;

	useEffect(() => {
		if (!router || !shareData) return;

		const mutable: { handled?: boolean } = {};
		if (!isReadOnly) RouterPathProvider.events.emitSync("unresolved-path", { path: router.path, mutable });
		if (mutable.handled) {
			pageDataContext.shareData = null;
			void router.pushPath("/");
			return;
		}

		const isPublic = shareData.isPublic;

		if (isPublic) {
			if (isReadOnly) return;
			if (typeof window !== "undefined" && !window.desktopOpened) {
				void startClonePublic(shareData as GitShareData);
			}
		} else {
			ModalToOpenService.setValue<ComponentProps<typeof CloneHandler>>(ModalToOpen.CloneHandler, {
				shareData,
			});
			pageDataContext.shareData = null;
		}
	}, [shareData, router, isReadOnly, startClonePublic]);
};

export default usePathnameCloneHandler;
