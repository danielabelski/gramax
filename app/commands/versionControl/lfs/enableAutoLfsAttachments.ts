import { Command } from "@app/types/Command";
import { ResponseKind } from "@app/types/ResponseKind";
import type Context from "@core/Context/Context";
import Path from "@core/FileProvider/Path/Path";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import type { AutoLfsProps } from "@core/GitLfs/logic/autoLfsAttachments";
import { customLfsExclude, LFS_FILTER_ATTR, resolveLfsExclude } from "@core/GitLfs/logic/autoLfsAttachments";
import { applyLfsMigration } from "@core/GitLfs/logic/lfsMigration";
import { workspaceLfsPolicy, workspaceSuppressesAutoLfs } from "@core/GitLfs/logic/workspaceManagedLfs";
import MergeConflictCaller from "@ext/git/actions/MergeConflictHandler/model/MergeConflictCaller";
import type MergeData from "@ext/git/actions/MergeConflictHandler/model/MergeData";
import type GitSourceData from "@ext/git/core/model/GitSourceData.schema";
import type { RepositoryMergeConflictState } from "@ext/git/core/Repository/state/RepositoryState";
import WorkdirRepository from "@ext/git/core/Repository/WorkdirRepository";
import { span } from "@ext/loggers/opentelemetry";
import isCatalogReadOnly from "@ext/workspace/utils/isCatalogReadOnly";
import { collectCatalogAutoLfsPatterns } from "./getAttachmentsMigrationStats";

export type EnableAutoLfsAttachmentsResult = {
	migrated: boolean;
	mergeData: MergeData;
	/**
	 * The masks `.gitattributes` carries once this returns. The settings form behind this command holds
	 * a copy read at mount, and its next Save is a `setAttrMany` that would strip whatever it missed.
	 */
	patterns?: string[];
	/**
	 * Why a migration that reports `migrated: true` still did not finish — the batch committed, the push
	 * failed. Answered 200 on purpose: the setting and the new masks are on disk, so the rest of this
	 * result is true and the client must keep it; the message only tells the user the push failed.
	 */
	error?: string;
};

const NOT_MIGRATED: EnableAutoLfsAttachmentsResult = { migrated: false, mergeData: { ok: true } };

/** What the catalog switch writes: nothing about the workspace is involved on this path. */
export const LFS_ATTACHMENTS_COMMIT_MESSAGE = "chore: move catalog attachments to LFS";

/**
 * The catalog's doc-root, relative to the repo root — the form `filesToPublish` takes. Read off the
 * root category ref rather than built from a constant: `DOC_ROOT_FILENAMES` has eight spellings and
 * only the catalog knows which one is on disk.
 */
const docRootRelPath = (catalog: Catalog): Path =>
	catalog.getRelativeRootCategoryPath().join(new Path(catalog.getRootCategoryRef().path.nameWithExtension));

const enableAutoLfsAttachments: Command<
	{ ctx: Context; catalogName: string; exclude?: string[] },
	EnableAutoLfsAttachmentsResult
> = Command.create({
	path: "versionControl/lfs/enableAutoLfsAttachments",
	kind: ResponseKind.json,

	async do({ ctx, catalogName, exclude }) {
		const { rp, wm, resourceUpdaterFactory } = this._app;
		const workspace = wm.current();
		const catalog = await workspace.getContextlessCatalog(catalogName);

		// The switch is disabled in the UI for such a workspace, but a disabled control guarantees nothing.
		if (await workspaceSuppressesAutoLfs(workspace)) return NOT_MIGRATED;
		const policy = await workspaceLfsPolicy(workspace);
		// A workspace that turned the auto-add on decides for every catalog under it, and the
		// workspace-wide sync is what moves their files — nothing here is the catalog's to turn on.
		if (policy.auto) return NOT_MIGRATED;
		if (!(catalog?.repo instanceof WorkdirRepository) || !catalog.repo.storage) return NOT_MIGRATED;
		if (await isCatalogReadOnly(this._app, workspace, ctx, catalog)) return NOT_MIGRATED;

		const data = rp.getSourceData<GitSourceData>(ctx, await catalog.repo.storage.getSourceName());
		if (!data) return NOT_MIGRATED;

		// As in `applyLfsMigration`: pull first so the service commit sits on top of the remote head.
		await catalog.repo.storage.fetch(data, false, false);
		if ((await catalog.repo.storage.getSyncCount()).pull) {
			const { mergeData: mergeFiles } = await catalog.repo.sync({ data });
			if (mergeFiles.length) {
				const state = await catalog.repo.getState();
				return {
					migrated: false,
					mergeData: {
						ok: false,
						mergeFiles,
						reverseMerge: (state.inner as RepositoryMergeConflictState).data?.reverseMerge,
						caller: MergeConflictCaller.Sync,
					},
				};
			}
		}

		const previousLfs: AutoLfsProps | undefined = catalog.props.lfs;
		// The same resolution the stats dialog ran, so both act on the list whose numbers the user saw.
		const effectiveExclude = resolveLfsExclude(exclude, previousLfs, policy);
		// Stored without the defaults: they hold whatever the props say, so a copy would only drift.
		const nextLfs: AutoLfsProps = { auto: true, exclude: customLfsExclude(effectiveExclude) };

		// The setting is saved before the migration on purpose: a migration that lands while the
		// switch stays off would leave the catalog telling the user the opposite of what happened.
		await catalog.updateProps({ ...catalog.props, lfs: nextLfs }, resourceUpdaterFactory.withContext(ctx));

		// The engine unwinds only while nothing has been committed; once a batch lands, it stays migrated.
		let committed = false;
		// Declared out here because the committed path reports them even when the migration then failed.
		let patterns: string[] = [];

		try {
			const added = await collectCatalogAutoLfsPatterns(this._app, ctx, catalog, effectiveExclude);
			const existing = (await catalog.repo.attributes(catalog.getRootCategoryPath())).findPatternsByAttr(
				LFS_FILTER_ATTR,
			);
			patterns = [...existing, ...added];

			if (added.length) {
				// The doc-root rides in the service commit: it holds the switch that caused this migration,
				// and a clone that pulls the masks and the pointers without it would auto-add nothing.
				await applyLfsMigration(workspace, catalog, data, patterns, LFS_ATTACHMENTS_COMMIT_MESSAGE, {
					extraFiles: [docRootRelPath(catalog)],
					onCommitted: () => {
						committed = true;
					},
				});
			}
			return { migrated: true, mergeData: { ok: true }, patterns };
		} catch (e) {
			// A commit landed, so the repository is migrated for real and the setting must stay on. Throwing
			// would answer 500 and leave the form holding `auto: false` and its pre-migration mask list, whose
			// next Save strips the masks this commit created. Report disk truth, carry the failure in `error`.
			if (committed) {
				span()?.addEvent("lfs-migration-committed-then-failed", { error: String(e) });
				return {
					migrated: true,
					mergeData: { ok: true },
					patterns,
					error: e instanceof Error ? e.message : String(e),
				};
			}

			// Nothing was committed, so the engine restored the files; the setting is ours to undo.
			try {
				await catalog.updateProps(
					{ ...catalog.props, lfs: previousLfs ?? { auto: false } },
					resourceUpdaterFactory.withContext(ctx),
				);
			} catch (rollbackError) {
				// The rollback must never mask why the migration failed.
				span()?.addEvent("lfs-setting-rollback-failed", { error: String(rollbackError) });
			}
			throw e;
		}
	},

	params(ctx, q, body) {
		// Left undefined on purpose when the caller sent nothing: `resolveLfsExclude` falls back to the
		// stored extras, while an explicit `[]` means the catalog adds none of its own.
		return { ctx, catalogName: q.catalogName, exclude: (body as { exclude?: string[] })?.exclude };
	},
});

export default enableAutoLfsAttachments;
