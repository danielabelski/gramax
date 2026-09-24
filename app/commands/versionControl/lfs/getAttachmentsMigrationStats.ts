import type Application from "@app/types/Application";
import { Command } from "@app/types/Command";
import { ResponseKind } from "@app/types/ResponseKind";
import type Context from "@core/Context/Context";
import type Path from "@core/FileProvider/Path/Path";
import parseContent from "@core/FileStructue/Article/parseContent";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import { LFS_FILTER_ATTR, resolveLfsExclude } from "@core/GitLfs/logic/autoLfsAttachments";
import collectAutoLfsPatterns from "@core/GitLfs/logic/collectAutoLfsPatterns";
import { getLfsDivergence, getLfsMigrationStats, type LfsDivergence } from "@core/GitLfs/logic/lfsMigration";
import { workspaceLfsPolicy } from "@core/GitLfs/logic/workspaceManagedLfs";
import WorkdirRepository from "@ext/git/core/Repository/WorkdirRepository";
import { span } from "@ext/loggers/opentelemetry";
import isCatalogReadOnly from "@ext/workspace/utils/isCatalogReadOnly";

export type AttachmentsMigrationStats = {
	fileCount: number;
	totalSize: number;
	added: string[];
	/** `.gitattributes` before and after the enable, for the dialog to show as a diff. */
	fileDiff?: LfsDivergence["fileDiff"];
};

const NONE: AttachmentsMigrationStats = { fileCount: 0, totalSize: 0, added: [] };

/**
 * The masks the catalog would gain: one per extension of the attachments its articles reference —
 * counting only the references that resolve to a real file inside the catalog — minus the
 * exclusions and minus anything an existing mask already covers.
 */
export const collectCatalogAutoLfsPatterns = async (
	app: Application,
	ctx: Context,
	catalog: Catalog,
	exclude: string[],
): Promise<string[]> => {
	const rootPath = catalog.getRootCategoryPath();
	const attributes = await catalog.repo.attributes(rootPath);
	const fp = app.wm.current().getFileProvider();
	// Keyed by path so an attachment several articles share is stat'ed once.
	const referenced = new Map<string, Path>();

	for (const item of catalog.getContentItems()) {
		try {
			await parseContent(item, catalog, ctx, app.parser, app.parserContextFactory);
		} catch (e) {
			// One article the parser chokes on must not take the whole feature down: on the enable path a
			// throw would roll the setting back, so the switch would refuse to turn on with nothing said.
			span()?.addEvent("attachment-parse-failed", { path: item.ref.path.value, error: String(e) });
			continue;
		}
		await item.parsedContent.read((p) => {
			if (!p) return;
			const resourceManager = p.parsedContext.getResourceManager();
			for (const resource of resourceManager.resources) {
				const absPath = resourceManager.getAbsolutePath(resource);
				referenced.set(absPath.value, absPath);
			}
		});
	}

	const relPaths: string[] = [];

	// A resource is whatever a node pointed at: an absolute URL joins onto the article path and arrives
	// looking like a descendant of the root, and a link may point at a folder or at a file that is gone.
	// Masks are permanent, so only a path resolving to a real file under the root may mint one.
	for (const absPath of referenced.values()) {
		const relPath = rootPath.subDirectory(absPath)?.value;
		if (!relPath) continue;
		if (!(await fp.exists(absPath))) continue;
		if (await fp.isFolder(absPath)) continue;
		relPaths.push(relPath);
	}

	return collectAutoLfsPatterns({
		exclude,
		patterns: attributes.findPatternsByAttr(LFS_FILTER_ATTR),
		relPaths,
	});
};

const getAttachmentsMigrationStats: Command<
	{ ctx: Context; catalogName: string; exclude?: string[] },
	AttachmentsMigrationStats
> = Command.create({
	path: "versionControl/lfs/getAttachmentsMigrationStats",
	kind: ResponseKind.json,

	async do({ ctx, catalogName, exclude }) {
		const { rp, wm } = this._app;
		const workspace = wm.current();
		const catalog = await workspace.getContextlessCatalog(catalogName);

		if (!(catalog?.repo instanceof WorkdirRepository) || !catalog.repo.storage) return NONE;
		if (await isCatalogReadOnly(this._app, workspace, ctx, catalog)) return NONE;
		if (!rp.getSourceData(ctx, await catalog.repo.storage.getSourceName())) return NONE;

		// The numbers shown here have to be the ones the enable will act on, so both resolve alike.
		const effectiveExclude = resolveLfsExclude(exclude, catalog.props.lfs, await workspaceLfsPolicy(workspace));
		const added = await collectCatalogAutoLfsPatterns(this._app, ctx, catalog, effectiveExclude);
		if (!added.length) return NONE;

		const existing = (await catalog.repo.attributes(catalog.getRootCategoryPath())).findPatternsByAttr(
			LFS_FILTER_ATTR,
		);
		const target = [...existing, ...added];
		const stats = await getLfsMigrationStats(workspace, catalog, target);
		// The same preview the sync flow draws: the engine serializes both sides of `setAttrMany`.
		const { fileDiff } = await getLfsDivergence(workspace, catalog, target);
		return { ...stats, added, fileDiff };
	},

	params(ctx, q, body) {
		// Left undefined on purpose when the caller sent nothing: `resolveLfsExclude` distinguishes
		// "absent" from an explicit empty list.
		return { ctx, catalogName: q.catalogName, exclude: (body as { exclude?: string[] })?.exclude };
	},
});

export default getAttachmentsMigrationStats;
