/** biome-ignore-all lint/suspicious/noExplicitAny: the stubs stand in for whole subsystems */
import type Application from "@app/types/Application";
import type Query from "@core/Api/Query";
import type Context from "@core/Context/Context";
import Path from "@core/FileProvider/Path/Path";
import parseContent from "@core/FileStructue/Article/parseContent";
import type { Catalog } from "@core/FileStructue/Catalog/Catalog";
import { DEFAULT_LFS_EXCLUDE } from "@core/GitLfs/logic/autoLfsAttachments";
import { getLfsDivergence, getLfsMigrationStats } from "@core/GitLfs/logic/lfsMigration";
import WorkdirRepository from "@ext/git/core/Repository/WorkdirRepository";
import { span } from "@ext/loggers/opentelemetry";
import getAttachmentsMigrationStats, { collectCatalogAutoLfsPatterns } from "./getAttachmentsMigrationStats";

jest.mock("@core/GitLfs/logic/lfsMigration", () => ({ getLfsMigrationStats: jest.fn(), getLfsDivergence: jest.fn() }));

jest.mock("@core/FileStructue/Article/parseContent", () => ({
	// biome-ignore lint/style/useNamingConvention: Jest ESM mock marker
	__esModule: true,
	default: jest.fn(),
}));

const addEvent = jest.fn();
jest.mock("@ext/loggers/opentelemetry", () => ({
	...jest.requireActual("@ext/loggers/opentelemetry"),
	span: jest.fn(),
}));

const parseContentMock = parseContent as jest.Mock;
const spanMock = span as jest.Mock;

const ctx = {} as Context;

const files = new Set<string>();
const folders = new Set<string>();

const fp = {
	exists: async (path: Path) => files.has(path.value) || folders.has(path.value),
	isFolder: async (path: Path) => folders.has(path.value),
};

const asFolder = (resource: string) => {
	files.delete(`catalog/${resource}`);
	folders.add(`catalog/${resource}`);
};

const asMissing = (resource: string) => files.delete(`catalog/${resource}`);

const app = {
	parser: {},
	parserContextFactory: {},
	wm: { current: () => ({ getFileProvider: () => fp }) },
} as unknown as Application;

const item = (path: string, resources: string[]) => {
	for (const resource of resources) files.add(`catalog/${resource}`);

	return {
		ref: { path: new Path(path) },
		parsedContent: {
			read: async (cb: (p: any) => void) =>
				cb({
					parsedContext: {
						getResourceManager: () => ({
							resources,
							getAbsolutePath: (resource: string) => new Path(`catalog/${resource}`),
						}),
					},
				}),
		},
	};
};

const catalogWith = (items: unknown[]): Catalog =>
	({
		getRootCategoryPath: () => new Path("catalog"),
		getContentItems: () => items,
		repo: { attributes: async () => ({ findPatternsByAttr: () => [] as string[] }) },
	}) as unknown as Catalog;

describe("collectCatalogAutoLfsPatterns", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		files.clear();
		folders.clear();
		parseContentMock.mockResolvedValue(undefined);
		spanMock.mockReturnValue({ addEvent });
	});

	it("collects one mask per referenced extension", async () => {
		const catalog = catalogWith([item("good.md", ["one.png"]), item("other.md", ["two.psd"])]);

		expect(await collectCatalogAutoLfsPatterns(app, ctx, catalog, [])).toEqual(["*.png", "*.psd"]);
	});

	it("skips an article the parser throws on and keeps walking the rest", async () => {
		const failure = new Error("bad markdown");
		parseContentMock.mockImplementation(async (article: any) => {
			if (article.ref.path.value === "broken.md") throw failure;
		});
		const catalog = catalogWith([item("broken.md", ["one.png"]), item("good.md", ["two.psd"])]);

		expect(await collectCatalogAutoLfsPatterns(app, ctx, catalog, [])).toEqual(["*.psd"]);
	});

	it("skips a reference that is not on disk", async () => {
		const catalog = catalogWith([item("good.md", ["one.png", "https:/host.vscode-cdn.net&session=c7e07c21"])]);
		asMissing("https:/host.vscode-cdn.net&session=c7e07c21");

		expect(await collectCatalogAutoLfsPatterns(app, ctx, catalog, [])).toEqual(["*.png"]);
	});

	it("skips a reference that is a directory", async () => {
		const catalog = catalogWith([item("good.md", ["one.png", "archive/report.2026"])]);
		asFolder("archive/report.2026");

		expect(await collectCatalogAutoLfsPatterns(app, ctx, catalog, [])).toEqual(["*.png"]);
	});

	it("skips a reference that escapes the catalog root", async () => {
		const catalog = catalogWith([item("good.md", ["one.png"])]);
		files.add("elsewhere/outside.psd");
		const escaping = {
			ref: { path: new Path("escaping.md") },
			parsedContent: {
				read: async (cb: (p: any) => void) =>
					cb({
						parsedContext: {
							getResourceManager: () => ({
								resources: ["outside.psd"],
								getAbsolutePath: (resource: string) => new Path(`elsewhere/${resource}`),
							}),
						},
					}),
			},
		};

		expect(
			await collectCatalogAutoLfsPatterns(app, ctx, catalogWith([...catalog.getContentItems(), escaping]), []),
		).toEqual(["*.png"]);
	});

	it("records the article it skipped on the span", async () => {
		parseContentMock.mockRejectedValue(new Error("bad markdown"));
		const catalog = catalogWith([item("broken.md", ["one.png"])]);

		await collectCatalogAutoLfsPatterns(app, ctx, catalog, []);

		expect(addEvent).toHaveBeenCalledWith(
			"attachment-parse-failed",
			expect.objectContaining({ path: "broken.md" }),
		);
	});
});

describe("versionControl/lfs/getAttachmentsMigrationStats", () => {
	const setup = (lfs: unknown, resources: string[]) => {
		const repo = Object.create(WorkdirRepository.prototype);
		Object.assign(repo, { attributes: async () => ({ findPatternsByAttr: () => [] as string[] }) });
		Object.defineProperty(repo, "storage", { value: { getSourceName: () => Promise.resolve("source") } });

		const catalog = {
			props: { lfs },
			repo,
			getRootCategoryPath: () => new Path("catalog"),
			getContentItems: () => [item("article.md", resources)],
		};

		Reflect.set(getAttachmentsMigrationStats, "_app", {
			conf: { isReadOnly: false },
			parser: {},
			parserContextFactory: {},
			rp: { getSourceData: () => ({ userName: "u" }) },
			wm: {
				current: () => ({
					config: () => Promise.resolve({}),
					getFileProvider: () => ({ ...fp, at: () => ({ isReadOnly: false }) }),
					getContextlessCatalog: () => Promise.resolve(catalog),
				}),
			},
		});
	};

	const run = (exclude?: string[]) => getAttachmentsMigrationStats.do({ ctx, catalogName: "catalog", exclude });

	beforeEach(() => {
		jest.clearAllMocks();
		files.clear();
		folders.clear();
		parseContentMock.mockResolvedValue(undefined);
		spanMock.mockReturnValue({ addEvent });
		(getLfsMigrationStats as jest.Mock).mockResolvedValue({ fileCount: 1, totalSize: 10 });
		(getLfsDivergence as jest.Mock).mockResolvedValue({ added: [], removed: [], legacyStaged: false });
	});

	it("reads exclude off the request body", () => {
		const params = getAttachmentsMigrationStats.params(ctx, { catalogName: "catalog" } as unknown as Query, {
			exclude: ["*.svg"],
		});

		expect(params.exclude).toEqual(["*.svg"]);
	});

	it("leaves exclude undefined when the caller sent no body", () => {
		expect(
			getAttachmentsMigrationStats.params(ctx, { catalogName: "catalog" } as unknown as Query, undefined).exclude,
		).toBeUndefined();
	});

	it("honours the exclusions the caller sent over the stored ones", async () => {
		setup({ auto: false, exclude: [] }, ["logo.svg"]);

		expect(await run(["*.svg"])).toEqual({ fileCount: 0, totalSize: 0, added: [] });
	});

	it("counts a type the caller stopped excluding, even though the stored list still excludes it", async () => {
		setup({ auto: false, exclude: ["*.psd"] }, ["logo.psd"]);

		expect(await run([])).toMatchObject({ added: ["*.psd"] });
	});

	it("counts none of the defaults, whatever the caller sends — they are not the caller's to drop", async () => {
		setup({ auto: false, exclude: [] }, [`logo${DEFAULT_LFS_EXCLUDE[0].slice(1)}`]);

		expect(await run([])).toEqual({ fileCount: 0, totalSize: 0, added: [] });
	});

	it("carries the .gitattributes diff for the masks it is about to report", async () => {
		const fileDiff = { before: "", after: "*.psd filter=lfs\n" };
		(getLfsDivergence as jest.Mock).mockResolvedValue({
			added: ["*.psd"],
			removed: [],
			legacyStaged: false,
			fileDiff,
		});
		setup({ auto: false, exclude: [] }, ["logo.psd"]);

		expect(await run([])).toMatchObject({ fileDiff });
		expect((getLfsDivergence as jest.Mock).mock.calls[0][2]).toEqual(["*.psd"]);
	});

	it("falls back to the stored exclusions when the caller sent none", async () => {
		setup({ auto: false, exclude: ["*.psd"] }, ["logo.psd"]);

		expect(await run(undefined)).toEqual({ fileCount: 0, totalSize: 0, added: [] });
	});

	it("falls back to the default exclusions when the catalog has no lfs block", async () => {
		setup(undefined, [`logo${DEFAULT_LFS_EXCLUDE[0].slice(1)}`]);

		expect(await run(undefined)).toEqual({ fileCount: 0, totalSize: 0, added: [] });
	});
});
