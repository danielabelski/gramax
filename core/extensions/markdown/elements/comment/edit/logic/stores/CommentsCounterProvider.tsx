import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { RequestStatus, useApi } from "@core-ui/hooks/useApi";
import { usePlatform } from "@core-ui/hooks/usePlatform";
import BranchUpdaterService, {
	type OnBranchUpdateListener,
} from "@ext/git/actions/Branch/BranchUpdaterService/logic/BranchUpdaterService";
import OnBranchUpdateCaller from "@ext/git/actions/Branch/BranchUpdaterService/model/OnBranchUpdateCaller";
import { useIsRevision } from "@ext/git/actions/Revisions/logic/hooks/useIsRevision";
import SyncService, { type SyncServiceEvents } from "@ext/git/actions/Sync/logic/SyncService";
import { type DependencyList, useCallback, useEffect } from "react";
import { type AuthoredCommentsByAuthor, setComments } from "./CommentsStore";

interface CommentsCounterProviderProps {
	children: React.ReactNode;
	deps?: DependencyList;
}

const CommentsCounterProvider = ({ children, deps = [] }: CommentsCounterProviderProps) => {
	const { isNext, isStatic, isStaticCli } = usePlatform();
	const { isReadOnly } = PageDataContextService.value.conf;
	const isRevision = useIsRevision();
	const skip = isReadOnly || isNext || isStatic || isStaticCli || isRevision;

	const { call, status, reset } = useApi<AuthoredCommentsByAuthor>({
		url: (api) => api.getCommentsByAuthors(),
		parse: "json",
		onDone: (data) => setComments(data || {}),
	});

	const refreshComments = useCallback(async () => {
		if (skip) return;
		await call();
	}, [call, skip]);

	useEffect(() => {
		const onBranchUpdate: OnBranchUpdateListener = (_, caller) => {
			if (
				caller !== OnBranchUpdateCaller.Checkout &&
				caller !== OnBranchUpdateCaller.CheckoutToNewCreatedBranch
			) {
				return;
			}
			return refreshComments();
		};
		const onSyncFinish: SyncServiceEvents["finish"] = ({ syncData }) => {
			if (!syncData.isVersionChanged) return;
			return refreshComments();
		};

		BranchUpdaterService.addListener(onBranchUpdate);
		const syncToken = SyncService.events.on("finish", onSyncFinish);

		return () => {
			BranchUpdaterService.removeListener(onBranchUpdate);
			SyncService.events.off(syncToken);
		};
	}, [refreshComments]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: only deps trigger refetch; status/reset/call are read but must not retrigger
	useEffect(() => {
		if (skip) return;
		if (status !== RequestStatus.Init) return;
		reset();
		void call();
	}, [skip, ...deps]);

	return children;
};

export default CommentsCounterProvider;
