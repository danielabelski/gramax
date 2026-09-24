/** biome-ignore-all lint/suspicious/noExplicitAny: the stubs stand in for whole subsystems */
import type Query from "@core/Api/Query";
import type Context from "@core/Context/Context";
import Path from "@core/FileProvider/Path/Path";
import { DEFAULT_LFS_EXCLUDE } from "@core/GitLfs/logic/autoLfsAttachments";
import { applyLfsMigration } from "@core/GitLfs/logic/lfsMigration";
import WorkdirRepository from "@ext/git/core/Repository/WorkdirRepository";
import enableAutoLfsAttachments, { LFS_ATTACHMENTS_COMMIT_MESSAGE } from "./enableAutoLfsAttachments";
import { collectCatalogAutoLfsPatterns } from "./getAttachmentsMigrationStats";

jest.mock("@core/GitLfs/logic/lfsMigration", () => ({ applyLfsMigration: jest.fn() }));
jest.mock("./getAttachmentsMigrationStats", () => ({ collectCatalogAutoLfsPatterns: jest.fn() }));

const applyLfsMigrationMock = applyLfsMigration as jest.Mock;
const collectPatternsMock = collectCatalogAutoLfsPatterns as jest.Mock;

const ctx = { user: {} } as unknown as Context;

const CATALOG_ROOT = "docs";
const DOC_ROOT = ".doc-root.yaml";

/** The options object the command hands the engine — its sixth argument. */
const migrationOptions = () => applyLfsMigrationMock.mock.calls[0][5];

type Harness = {
	catalog: any;
	order: string[];
	lfsSeenByMigration: () => any;
};

const setup = (props: any, workspacePatterns?: string[]): Harness => {
	const order: string[] = [];
	let lfsSeenByMigration: any;

	const repo = Object.create(WorkdirRepository.prototype);
	Object.assign(repo, { attributes: jest.fn().mockResolvedValue({ findPatternsByAttr: () => ["*.psd"] }) });
	Object.defineProperty(repo, "storage", {
		value: {
			getSourceName: () => Promise.resolve("source"),
			fetch: jest.fn().mockResolvedValue(undefined),
			getSyncCount: jest.fn().mockResolvedValue({ pull: 0 }),
		},
	});

	const catalog: any = {
		props,
		repo,
		getRootCategoryPath: () => new Path("catalog"),
		getRelativeRootCategoryPath: () => new Path(CATALOG_ROOT),
		getRootCategoryRef: () => ({ path: new Path(`${CATALOG_ROOT}/${DOC_ROOT}`) }),
		updateProps: jest.fn(async (next: any) => {
			order.push("updateProps");
			catalog.props = next;
		}),
	};

	const workspace = {
		config: () => Promise.resolve(workspacePatterns ? { git: { lfs: { patterns: workspacePatterns } } } : {}),
		getFileProvider: () => ({ at: () => ({ isReadOnly: false }) }),
		getContextlessCatalog: () => Promise.resolve(catalog),
	};

	applyLfsMigrationMock.mockImplementation(async () => {
		order.push("applyLfsMigration");
		lfsSeenByMigration = catalog.props.lfs;
	});

	Reflect.set(enableAutoLfsAttachments, "_app", {
		conf: { isReadOnly: false },
		rp: { getSourceData: () => ({ userName: "u" }) },
		wm: { current: () => workspace },
		resourceUpdaterFactory: { withContext: () => ({}) },
	});

	return { catalog, order, lfsSeenByMigration: () => lfsSeenByMigration };
};

const run = (exclude?: string[]) => enableAutoLfsAttachments.do({ ctx, catalogName: "catalog", exclude });

const runThroughParams = (body: unknown) =>
	enableAutoLfsAttachments.do(
		enableAutoLfsAttachments.params(ctx, { catalogName: "catalog" } as unknown as Query, body),
	);

describe("versionControl/lfs/enableAutoLfsAttachments", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		collectPatternsMock.mockResolvedValue(["*.png"]);
	});

	describe("params", () => {
		const params = (body: unknown) =>
			enableAutoLfsAttachments.params(ctx, { catalogName: "catalog" } as unknown as Query, body);

		it("leaves exclude undefined when no body was sent, so the default can apply", () => {
			expect(params(undefined).exclude).toBeUndefined();
		});

		it("leaves exclude undefined when the body carries no exclude key", () => {
			expect(params({}).exclude).toBeUndefined();
		});

		it("keeps an explicitly emptied exclude list empty", () => {
			expect(params({ exclude: [] }).exclude).toEqual([]);
		});

		it("passes an explicit list through untouched", () => {
			expect(params({ exclude: ["*.svg", "*.gif"] }).exclude).toEqual(["*.svg", "*.gif"]);
		});
	});

	describe("exclude defaulting", () => {
		it("migrates against DEFAULT_LFS_EXCLUDE when exclude is absent, and stores no copy of it", async () => {
			const { catalog } = setup({});

			await run(undefined);

			expect(catalog.props.lfs).toEqual({ auto: true, exclude: [] });
			expect(collectPatternsMock).toHaveBeenCalledWith(expect.anything(), ctx, catalog, DEFAULT_LFS_EXCLUDE);
		});

		it("keeps the defaults on an explicitly emptied list — emptied means no extras, not none at all", async () => {
			const { catalog } = setup({});

			await run([]);

			expect(catalog.props.lfs).toEqual({ auto: true, exclude: [] });
			expect(collectPatternsMock).toHaveBeenCalledWith(expect.anything(), ctx, catalog, DEFAULT_LFS_EXCLUDE);
		});

		it("stores the extras alone and migrates against them plus the defaults", async () => {
			const { catalog } = setup({});

			await run([...DEFAULT_LFS_EXCLUDE, "*.psd"]);

			expect(catalog.props.lfs).toEqual({ auto: true, exclude: ["*.psd"] });
			expect(collectPatternsMock).toHaveBeenCalledWith(expect.anything(), ctx, catalog, [
				...DEFAULT_LFS_EXCLUDE,
				"*.psd",
			]);
		});

		it("applies DEFAULT_LFS_EXCLUDE when a bodyless request goes through params into do", async () => {
			const { catalog } = setup({});

			await runThroughParams(undefined);

			expect(catalog.props.lfs).toEqual({ auto: true, exclude: [] });
			expect(collectPatternsMock).toHaveBeenCalledWith(expect.anything(), ctx, catalog, DEFAULT_LFS_EXCLUDE);
		});

		it("keeps an explicitly emptied body list empty when it goes through params into do", async () => {
			const { catalog } = setup({});

			await runThroughParams({ exclude: [] });

			expect(catalog.props.lfs).toEqual({ auto: true, exclude: [] });
		});
	});

	describe("a workspace that manages the masks itself", () => {
		it("refuses to enable, leaving the setting and the repository untouched", async () => {
			const { catalog, order } = setup({}, ["*.png"]);

			const result = await run(undefined);

			expect(result).toEqual({ migrated: false, mergeData: { ok: true } });
			expect(catalog.props.lfs).toBeUndefined();
			expect(order).toEqual([]);
			expect(applyLfsMigrationMock).not.toHaveBeenCalled();
		});
	});

	describe("happy path", () => {
		it("saves the setting before the migration runs", async () => {
			const harness = setup({ lfs: { auto: false } });

			const result = await run(["*.psd"]);

			expect(harness.order).toEqual(["updateProps", "applyLfsMigration"]);
			expect(harness.lfsSeenByMigration()).toEqual({ auto: true, exclude: ["*.psd"] });
			expect(result).toEqual({ migrated: true, mergeData: { ok: true }, patterns: ["*.psd", "*.png"] });
		});

		it("reports the mask list .gitattributes ends up with", async () => {
			setup({});

			const result = await run(["*.svg"]);

			expect(result.patterns).toEqual(["*.psd", "*.png"]);
		});

		it("reports the untouched mask list when there was nothing to add", async () => {
			collectPatternsMock.mockResolvedValue([]);
			setup({});

			expect((await run(["*.svg"])).patterns).toEqual(["*.psd"]);
		});

		it("migrates against the existing patterns plus the collected ones, under its own commit message", async () => {
			setup({});

			await run(["*.svg"]);

			expect(applyLfsMigrationMock).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				expect.anything(),
				["*.psd", "*.png"],
				LFS_ATTACHMENTS_COMMIT_MESSAGE,
				expect.objectContaining({ onCommitted: expect.any(Function) }),
			);
			expect(LFS_ATTACHMENTS_COMMIT_MESSAGE).not.toContain("workspace");
		});

		it("hands the doc-root to the migration, so the setting rides in the commit it makes", async () => {
			setup({});

			await run(["*.svg"]);

			expect(migrationOptions().extraFiles.map((file: Path) => file.value)).toEqual([
				`${CATALOG_ROOT}/${DOC_ROOT}`,
			]);
		});

		it("hands the engine nothing to commit when there is nothing to migrate", async () => {
			collectPatternsMock.mockResolvedValue([]);
			setup({});

			await run(["*.svg"]);

			expect(applyLfsMigrationMock).not.toHaveBeenCalled();
		});
	});

	describe("rollback", () => {
		it("restores the previous setting and rethrows when the migration fails", async () => {
			const previous = { auto: false, exclude: ["*.gif"] };
			const { catalog, order } = setup({ lfs: previous });
			const failure = new Error("migration blew up");
			applyLfsMigrationMock.mockImplementation(async () => {
				order.push("applyLfsMigration");
				throw failure;
			});

			await expect(run(["*.svg"])).rejects.toBe(failure);

			expect(order).toEqual(["updateProps", "applyLfsMigration", "updateProps"]);
			expect(catalog.props.lfs).toEqual(previous);
		});

		it("rolls back to an explicit disabled setting when the catalog had none", async () => {
			const { catalog } = setup({});
			applyLfsMigrationMock.mockRejectedValue(new Error("migration blew up"));

			await expect(run(["*.svg"])).rejects.toThrow("migration blew up");

			expect(catalog.props.lfs).toEqual({ auto: false });
		});

		it("does not roll back when the migration never runs", async () => {
			collectPatternsMock.mockResolvedValue([]);
			const { catalog, order } = setup({});

			const result = await run(["*.psd"]);

			expect(applyLfsMigrationMock).not.toHaveBeenCalled();
			expect(order).toEqual(["updateProps"]);
			expect(catalog.props.lfs).toEqual({ auto: true, exclude: ["*.psd"] });
			expect(result).toEqual({ migrated: true, mergeData: { ok: true }, patterns: ["*.psd"] });
		});

		const migrationCommitsThenFails = (order: string[], failure: Error) =>
			applyLfsMigrationMock.mockImplementation(
				async (_w: any, _c: any, _d: any, _p: string[], _m: string, { onCommitted }: any) => {
					order.push("applyLfsMigration");
					onCommitted();
					throw failure;
				},
			);

		it("keeps the setting on when the migration failed after it had already committed", async () => {
			const { catalog, order } = setup({ lfs: { auto: false } });
			migrationCommitsThenFails(order, new Error("push blew up"));

			await run(["*.psd"]);

			expect(order).toEqual(["updateProps", "applyLfsMigration"]);
			expect(catalog.props.lfs).toEqual({ auto: true, exclude: ["*.psd"] });
		});

		it("reports the post-migration mask list when the migration committed and then failed", async () => {
			const { order } = setup({ lfs: { auto: false } });
			migrationCommitsThenFails(order, new Error("push blew up"));

			const result = await run(["*.svg"]);

			expect(result.patterns).toEqual(["*.psd", "*.png"]);
			expect(result.migrated).toBe(true);
		});

		it("carries the failure message so the client can still surface it", async () => {
			const { order } = setup({ lfs: { auto: false } });
			migrationCommitsThenFails(order, new Error("push blew up"));

			expect((await run(["*.svg"])).error).toBe("push blew up");
		});

		it("rethrows the migration error even when the rollback itself fails", async () => {
			const { catalog } = setup({ lfs: { auto: false } });
			const failure = new Error("migration blew up");
			applyLfsMigrationMock.mockRejectedValue(failure);
			catalog.updateProps.mockImplementationOnce(async (next: any) => {
				catalog.props = next;
			});
			catalog.updateProps.mockImplementationOnce(async () => {
				throw new Error("rollback blew up");
			});

			await expect(run(["*.svg"])).rejects.toBe(failure);
		});
	});
});
