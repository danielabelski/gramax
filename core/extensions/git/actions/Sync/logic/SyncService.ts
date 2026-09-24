/** biome-ignore-all lint/suspicious/noExplicitAny: it's ok */
/** biome-ignore-all lint/complexity/noStaticOnlyClass: it's ok */
import ArticleUpdaterService from "@components/Article/ArticleUpdater/ArticleUpdaterService";
import { createEventEmitter, type Event } from "@core/Event/EventEmitter";
import type ApiUrlCreator from "@core-ui/ApiServices/ApiUrlCreator";
import FetchService from "@core-ui/ApiServices/FetchService";
import DefaultError from "@ext/errorHandlers/logic/DefaultError";
import tryOpenMergeConflict from "@ext/git/actions/MergeConflictHandler/logic/tryOpenMergeConflict";
import tryOpenMergeResolver from "@ext/git/actions/MergeConflictHandler/logic/tryOpenMergeResolver";
import type ClientSyncResult from "@ext/git/core/model/ClientSyncResult";
import { span, traced } from "@ext/loggers/opentelemetry";
import runLfsMigrationFlow from "./runLfsMigrationFlow";

export type SyncServiceEvents = Event<"start"> &
	Event<"finish", { syncData: ClientSyncResult }> &
	Event<"conflict-resolved"> &
	Event<"conflict-aborted"> &
	Event<"error", { error: DefaultError; apiUrlCreator: ApiUrlCreator }>;

type SyncResult = { resOk: true; syncData: ClientSyncResult } | { resOk: false; error: DefaultError };

export default class SyncService {
	private static _events = createEventEmitter<SyncServiceEvents>();

	static get events() {
		return SyncService._events;
	}

	public static async sync(apiUrlCreator: ApiUrlCreator, overrideResolve?: boolean) {
		await SyncService.events.emit("start", {});
		const data = await SyncService._sync(apiUrlCreator);

		if (!data.resOk && "error" in data) {
			await SyncService.events.emit("error", {
				error: data.error,
				apiUrlCreator,
			});
			return;
		}

		// Every listener that takes a "start" pairs it with "finish" or "error", so a sync that ends
		// in neither leaks whatever that listener holds (spinner, busy flag, pending promise).
		// _onFinish touches the editor and the page data, so a throw here is not hypothetical.
		// Not rethrown: callers already treat a failed sync as a normal outcome (see the !resOk
		// branch above) and some don't await sync() at all — traced() records the exception.
		try {
			await traced("sync-on-finish", () => SyncService._onFinish(data.syncData, apiUrlCreator, overrideResolve));
		} catch (e) {
			await SyncService.events.emit("error", {
				error: e instanceof DefaultError ? e : new DefaultError(e?.message ?? String(e), e),
				apiUrlCreator,
			});
			return;
		}

		await SyncService.events.emit("finish", { syncData: data.syncData });
	}

	private static async _sync(apiUrlCreator: ApiUrlCreator): Promise<SyncResult> {
		const res = await FetchService.fetch<ClientSyncResult>(apiUrlCreator.getStorageSyncUrl());
		if (!res.ok) {
			const errorFromFetch = ((res as any).error ?? (res as any).body) as DefaultError;
			if (errorFromFetch) return { resOk: false, error: errorFromFetch };

			try {
				return { resOk: false, error: (await res.json()) as unknown as DefaultError };
			} catch {
				return { resOk: false, error: new DefaultError("Sync failed") };
			}
		}
		return { resOk: true, syncData: await res.json() };
	}

	private static async _onFinish(
		syncData: ClientSyncResult,
		apiUrlCreator: ApiUrlCreator,
		overrideResolve?: boolean,
	) {
		if (!syncData.mergeData.ok) {
			if (overrideResolve) {
				tryOpenMergeResolver({
					mergeData: { ...syncData.mergeData },
					onResolve: () => void SyncService.events.emit("conflict-resolved", {}),
					onAbort: () => void SyncService.events.emit("conflict-aborted", {}),
					onUpdateBranch: false,
				});
			} else {
				tryOpenMergeConflict({
					mergeData: { ...syncData.mergeData },
					onResolve: () => void SyncService.events.emit("conflict-resolved", {}),
					onAbort: () => void SyncService.events.emit("conflict-aborted", {}),
				});
			}
			return;
		}
		await ArticleUpdaterService.update(apiUrlCreator);
		await traced("lfs-migration-flow", async () => {
			try {
				await runLfsMigrationFlow(apiUrlCreator);
			} catch (e) {
				// LFS settings migration must never break the sync flow; it will be re-prompted on the next sync
				span()?.addEvent("lfs-migration-failed", { level: "important", error: String(e) });
			}
		});
		void refreshPage();
	}
}
