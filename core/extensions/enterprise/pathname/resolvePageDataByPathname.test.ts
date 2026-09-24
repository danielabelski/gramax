import Path from "@core/FileProvider/Path/Path";
import { PageDataType } from "@core/RouterPath/logic/getPageDataByPathname";
import SourceType from "@ext/storage/logic/SourceDataProvider/model/SourceType";
import type { Workspace } from "@ext/workspace/Workspace";
import type { WorkspaceConfig } from "@ext/workspace/WorkspaceConfig";
import WorkspaceManager from "@ext/workspace/WorkspaceManager";
import { resolvePageDataByPathname } from "./resolvePageDataByPathname";

const mockLib = {
	getCatalogOrFindAtAnyWorkspace: (catalogName: string) => {
		const catalogs = {
			exist_in_lib_local: { repo: {} },
			exist_in_lib_remote: {
				repo: {
					storage: {
						getType: () => SourceType.gitHub,
						getSourceName: () => "github.com",
						getGroup: () => "user",
						getName: () => "exist_in_lib_remote",
					},
				},
			},

			local_catalog: { repo: {} },
			default_rep_name: {
				repo: {
					storage: {
						getType: () => SourceType.gitHub,
						getSourceName: () => "github.com",
						getGroup: () => "user",
						getName: () => "default_rep_name",
					},
				},
			},
		};

		return catalogs[catalogName];
	},

	maybeCurrent: () => mockLib,
	current: () => mockLib,
	config: (): Partial<WorkspaceConfig> => ({ enterprise: { gesUrl: "https://github.com" } }),
};

const getDataType = async (pathname: string) =>
	(await resolvePageDataByPathname(new Path(pathname), mockLib as unknown as WorkspaceManager)).pageData;

describe("resolvePageDataByPathname", () => {
	test.each(["dr/repo/main/-/article", "team.docs/repo/main/-/article", "public/dr/repo/main/-/article"])(
		"сохраняет короткий pathname для client-side перехвата без workspace: %s",
		async (path) => {
			const wm = { maybeCurrent: () => null } as unknown as WorkspaceManager;
			const result = await resolvePageDataByPathname(path, wm);
			expect(result.pageData.type).toBe(PageDataType.home);
			expect(result.pathnameData.sourceName).toBeNull();
		},
	);
	test("полная ссылка внешнего storage сохраняет сценарий клонирования", async () => {
		const wm = { maybeCurrent: () => null } as unknown as WorkspaceManager;
		const result = await resolvePageDataByPathname("gitlab.example/dr/repo/main/-/article", wm);
		expect(result.pathnameData.sourceName).toBe("gitlab.example");
	});
	describe("находит", () => {
		describe("статью по ссылке на каталог", () => {
			test("локальный", async () => {
				const pathname = "-/-/-/-/local_catalog/file";

				expect(await getDataType(pathname)).toEqual({
					type: PageDataType.article,
					itemLogicPath: ["local_catalog", "file"],
				});
			});
			describe("не локальный", () => {
				test("переключает workspace на каталог с совпадающим внешним storage", async () => {
					const catalog = (sourceName: string) => ({
						repo: {
							storage: {
								getType: () => SourceType.gitLab,
								getSourceName: () => sourceName,
								getGroup: () => "dr",
								getName: () => "gramax-board",
							},
						},
					});
					const workspaces = new Map<string, Workspace>([
						[
							"ges",
							{
								path: () => "ges",
								config: async () => ({ enterprise: { gesUrl: "https://ges.example" } }),
								getContextlessCatalog: async (name: string) =>
									name === "gramax-board" ? catalog("ges.example") : null,
							} as unknown as Workspace,
						],
						[
							"open-source",
							{
								path: () => "open-source",
								config: async () => ({}),
								getContextlessCatalog: async (name: string) =>
									name === "gramax-board" ? catalog("gitlab.ics-it.ru") : null,
							} as unknown as Workspace,
						],
					]);
					const wm = Object.create(WorkspaceManager.prototype) as WorkspaceManager;
					Reflect.set(wm, "_current", workspaces.get("ges"));
					Reflect.set(
						wm,
						"_workspaces",
						new Map(
							Array.from(workspaces.keys()).map((path) => [path, { catalogNames: ["gramax-board"] }]),
						),
					);
					wm.setWorkspace = jest.fn(async (path: string) => {
						Reflect.set(wm, "_current", workspaces.get(path));
					});

					const resolved = await resolvePageDataByPathname(
						"gitlab.ics-it.ru/dr/gramax-board/master/board/uncategorized/article-properties-popover",
						wm,
					);

					expect(resolved.pageData).toEqual({
						type: PageDataType.article,
						itemLogicPath: ["gramax-board", "uncategorized", "article-properties-popover"],
					});
					expect(wm.current()).toBe(workspaces.get("open-source"));
				});

				test("по короткой ссылке встроенного GES-хранилища", async () => {
					const pathname = "user/default_rep_name/master/-/file";

					const resolved = await resolvePageDataByPathname(pathname, mockLib as unknown as WorkspaceManager);
					expect(resolved.pathnameData.sourceName).toBe("github.com");

					expect(await getDataType(pathname)).toEqual({
						type: PageDataType.article,
						itemLogicPath: ["default_rep_name", "file"],
					});
				});

				test("по короткой ссылке с точкой в названии группы", async () => {
					const previousGetCatalog = mockLib.getCatalogOrFindAtAnyWorkspace;
					mockLib.getCatalogOrFindAtAnyWorkspace = (catalogName: string) =>
						catalogName === "default_rep_name"
							? {
									repo: {
										storage: {
											getType: () => SourceType.gitHub,
											getSourceName: () => "github.com",
											getGroup: () => "team.docs",
											getName: () => "default_rep_name",
										},
									},
								}
							: previousGetCatalog(catalogName);

					try {
						expect(await getDataType("team.docs/default_rep_name/master/-/file")).toEqual({
							type: PageDataType.article,
							itemLogicPath: ["default_rep_name", "file"],
						});
					} finally {
						mockLib.getCatalogOrFindAtAnyWorkspace = previousGetCatalog;
					}
				});

				test("по старой полной ссылке встроенного хранилища с bare hostname", async () => {
					const previousConfig = mockLib.config;
					const previousGetCatalog = mockLib.getCatalogOrFindAtAnyWorkspace;
					mockLib.config = () => ({ enterprise: { gesUrl: "https://ges" } });
					mockLib.getCatalogOrFindAtAnyWorkspace = (catalogName: string) => {
						const catalog = previousGetCatalog(catalogName);
						if (catalogName !== "default_rep_name") return catalog;
						return {
							repo: {
								storage: { ...catalog.repo.storage, getSourceName: () => "ges" },
							},
						};
					};

					try {
						expect(await getDataType("ges/user/default_rep_name/master/-/file")).toEqual({
							type: PageDataType.article,
							itemLogicPath: ["default_rep_name", "file"],
						});
					} finally {
						mockLib.config = previousConfig;
						mockLib.getCatalogOrFindAtAnyWorkspace = previousGetCatalog;
					}
				});

				test("по короткой ссылке встроенного Enterprise Cloud-хранилища", async () => {
					const previousConfig = mockLib.config;
					mockLib.config = () => ({ enterpriseCloud: { url: "https://github.com" } });

					try {
						expect(await getDataType("user/default_rep_name/master/-/file")).toEqual({
							type: PageDataType.article,
							itemLogicPath: ["default_rep_name", "file"],
						});
					} finally {
						mockLib.config = previousConfig;
					}
				});

				test("с веткой", async () => {
					const pathname = "github.com/user/default_rep_name/master/-/file";

					expect(await getDataType(pathname)).toEqual({
						type: PageDataType.article,
						itemLogicPath: ["default_rep_name", "file"],
					});
				});
				test("без ветки", async () => {
					const pathname = "github.com/user/default_rep_name/-/-/file";

					expect(await getDataType(pathname)).toEqual({
						type: PageDataType.article,
						itemLogicPath: ["default_rep_name", "file"],
					});
				});
				test("с отличным названием каталога, но такого названия нет в библиотеке", async () => {
					const pathname = "github.com/user/default_rep_name/-/other_catalog_name/file";

					expect(await getDataType(pathname)).toEqual({
						type: PageDataType.article,
						itemLogicPath: ["default_rep_name", "file"],
					});
				});
			});
		});
		test("главную страницу по валидной ссылке", async () => {
			const pathname = "github.com/user/catalog_not_in_lib/master/-/file";

			expect(await getDataType(pathname)).toEqual({ type: PageDataType.home });
		});
		test("главную страницу по ссылке на bare host:port (gh#926)", async () => {
			const pathname = "gitea-server:3000/user/catalog_not_in_lib/master/-/file";

			expect(await getDataType(pathname)).toEqual({ type: PageDataType.home });
		});
	});
	describe("не находит", () => {
		test("статью по короткой ссылке внешнего хранилища", async () => {
			const previousConfig = mockLib.config;
			mockLib.config = () => ({});

			try {
				const result = await resolvePageDataByPathname(
					"user/default_rep_name/master/-/file",
					mockLib as unknown as WorkspaceManager,
				);
				expect(result.pageData.type).toBe(PageDataType.home);
				expect(result.pathnameData.sourceName).toBeNull();
			} finally {
				mockLib.config = previousConfig;
			}
		});

		describe("статью по ссылке на каталог", () => {
			test("локальный", async () => {
				const pathname = "-/-/-/-/local_catalog_not_in_lib";

				expect(await getDataType(pathname)).toEqual({ type: PageDataType.notFound });
			});
			describe("с отличным названием каталога, но в библиотеке есть такой каталог", () => {
				test("локальный", async () => {
					const pathname = "github.com/user/default_rep_name/-/exist_in_lib_local/file";

					expect(await getDataType(pathname)).toEqual({
						type: PageDataType.notFound,
					});
				});

				test("не локальный", async () => {
					const pathname = "github.com/user/default_rep_name/-/exist_in_lib_remote/file";

					expect(await getDataType(pathname)).toEqual({
						type: PageDataType.notFound,
					});
				});
			});
		});
		test("статью по невалидным данным в ссылке", async () => {
			const invalidSourceName = "gitaaahub.com/user/default_rep_name/master/-";
			const invalidGroup = "github.com/useeer/default_rep_name/master/-";
			const invalidRepName = "github.com/user/default_catalooooog/master/default_rep_name";
			const noCatalogName = "github.com/user/-/master/default_rep_name/-";
			expect(await getDataType(invalidRepName)).toEqual({ type: PageDataType.notFound });

			expect(await getDataType(invalidSourceName)).toEqual({ type: PageDataType.notFound });
			expect(await getDataType(invalidGroup)).toEqual({ type: PageDataType.notFound });
			expect(await getDataType(noCatalogName)).toEqual({ type: PageDataType.notFound });
		});
	});
});
