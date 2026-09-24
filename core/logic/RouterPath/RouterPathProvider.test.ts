import Path from "@core/FileProvider/Path/Path";
import { describe, expect, it } from "@jest/globals";
import RouterPathProvider from "./RouterPathProvider";

describe("RouterPathProvider", () => {
	describe("parsePath", () => {
		it("должен разбирать простой путь", () => {
			const result = RouterPathProvider.parsePath("source/group/repo/branch/dir/file");

			expect(result).toEqual({
				sourceName: null,
				group: null,
				repo: null,
				refname: null,
				catalogName: "source",
				language: undefined,
				filePath: ["group", "repo", "branch", "dir", "file"],
				itemLogicPath: ["source", "group", "repo", "branch", "dir", "file"],
				repNameItemLogicPath: null,
				hash: "",
				isPublic: false,
			});
		});

		it("должен разбирать путь с закодированными URI компонентами", () => {
			const result = RouterPathProvider.parsePath(
				"source%20name/group%20name/repo/branch/dir/file%20with%20spaces",
			);

			expect(result).toEqual({
				sourceName: null,
				group: null,
				repo: null,
				refname: null,
				catalogName: "source%20name",
				language: undefined,
				filePath: ["group name", "repo", "branch", "dir", "file with spaces"],
				itemLogicPath: ["source%20name", "group name", "repo", "branch", "dir", "file with spaces"],
				repNameItemLogicPath: null,
				hash: "",
				isPublic: false,
			});
		});

		it("должен разбирать путь с языком", () => {
			const result = RouterPathProvider.parsePath("source/group/repo/branch/dir/en/file");

			expect(result).toEqual({
				sourceName: null,
				group: null,
				repo: null,
				refname: null,
				catalogName: "source",
				language: undefined,
				filePath: ["group", "repo", "branch", "dir", "en", "file"],
				itemLogicPath: ["source", "group", "repo", "branch", "dir", "en", "file"],
				repNameItemLogicPath: null,
				hash: "",
				isPublic: false,
			});
		});

		it("должен разбирать путь с хешем", () => {
			const result = RouterPathProvider.parsePath("source/group/repo/branch/dir#hash/file");

			expect(result).toEqual({
				sourceName: null,
				group: null,
				repo: null,
				refname: null,
				catalogName: "source",
				language: undefined,
				filePath: ["group", "repo", "branch", "dir#hash", "file"],
				itemLogicPath: ["source", "group", "repo", "branch", "dir#hash", "file"],
				repNameItemLogicPath: null,
				hash: "",
				isPublic: false,
			});
		});

		it("должен разбирать путь с префиксом public", () => {
			const result = RouterPathProvider.parsePath("public/source/group/repo/branch/dir/file");

			expect(result).toEqual({
				sourceName: null,
				group: null,
				repo: null,
				refname: null,
				catalogName: "public",
				language: undefined,
				filePath: ["source", "group", "repo", "branch", "dir", "file"],
				itemLogicPath: ["public", "source", "group", "repo", "branch", "dir", "file"],
				repNameItemLogicPath: null,
				hash: "",
				isPublic: false,
			});
		});

		it("должен разбирать путь с минимальными компонентами", () => {
			const result = RouterPathProvider.parsePath("source/group/repo");

			expect(result).toEqual({
				sourceName: null,
				group: null,
				repo: null,
				refname: null,
				catalogName: "source",
				language: undefined,
				filePath: ["group", "repo"],
				itemLogicPath: ["source", "group", "repo"],
				repNameItemLogicPath: null,
				hash: "",
				isPublic: false,
			});
		});
		it("должен разбирать путь с хранилищем и портом", () => {
			const result = RouterPathProvider.parsePath("localhost:8080/group/repo/branch/dir/file");

			expect(result).toEqual({
				sourceName: "localhost:8080",
				group: "group",
				repo: "repo",
				refname: "branch",
				catalogName: "dir",
				language: undefined,
				filePath: ["file"],
				itemLogicPath: ["dir", "file"],
				repNameItemLogicPath: ["repo", "file"],
				hash: "",
				isPublic: false,
			});
		});

		it("должен разбирать desktop-ссылку с origin tauri://localhost как путь редактора", () => {
			const web = RouterPathProvider.parsePath("github.com/user/repo/master/-/file");
			const desktop = RouterPathProvider.parsePath("tauri://localhost/github.com/user/repo/master/-/file");

			expect(desktop).toEqual(web);
		});

		it("должен разбирать путь с сепаратором", () => {
			const result = RouterPathProvider.parsePath("source/group/repo/branch/-/file");

			expect(result).toEqual({
				sourceName: null,
				group: null,
				repo: null,
				refname: null,
				catalogName: "source",
				language: undefined,
				filePath: ["group", "repo", "branch", "null", "file"],
				itemLogicPath: ["source", "group", "repo", "branch", "null", "file"],
				repNameItemLogicPath: null,
				hash: "",
				isPublic: false,
			});
		});

		it("должен разбирать путь с null сегментами", () => {
			const result = RouterPathProvider.parsePath("source/-/repo/-/-/file");

			expect(result).toEqual({
				sourceName: "source",
				group: null,
				repo: "repo",
				refname: null,
				catalogName: "repo",
				language: undefined,
				filePath: ["file"],
				itemLogicPath: ["repo", "file"],
				repNameItemLogicPath: ["repo", "file"],
				hash: "",
				isPublic: false,
			});
		});

		it("должен разбирать путь с сепараторами в формате из getPageDataByPathname.test.ts", () => {
			const result = RouterPathProvider.parsePath("-/-/-/-/local_catalog/file");

			expect(result).toEqual({
				sourceName: null,
				group: null,
				repo: null,
				refname: null,
				catalogName: "local_catalog",
				language: undefined,
				filePath: ["file"],
				itemLogicPath: ["local_catalog", "file"],
				repNameItemLogicPath: null,
				hash: "",
				isPublic: false,
			});
		});

		it("должен разбирать путь с сепараторами и публичным префиксом", () => {
			const result = RouterPathProvider.parsePath("public/-/-/-/-/local_catalog/file");

			expect(result).toEqual({
				sourceName: null,
				group: null,
				repo: null,
				refname: null,
				catalogName: "local_catalog",
				language: undefined,
				filePath: ["file"],
				itemLogicPath: ["local_catalog", "file"],
				repNameItemLogicPath: null,
				hash: "",
				isPublic: true,
			});
		});
	});

	describe("getPathname", () => {
		it("должен генерировать путь из PathnameData", () => {
			const data = {
				sourceName: "source",
				group: "group",
				repo: "repo",
				refname: "branch",
				catalogName: "dir",
				language: undefined,
				filePath: ["file"],
				itemLogicPath: ["dir", "file"],
				repNameItemLogicPath: ["repo", "file"],
				hash: "",
				isPublic: false,
			};

			const result = RouterPathProvider.getPathname(data);

			expect(result.value).toBe("source/group/repo/branch/dir/file");
		});

		it("должен кодировать URI компоненты в пути", () => {
			const data = {
				sourceName: "source name",
				group: "group name",
				repo: "repo",
				refname: "branch name",
				catalogName: "dir",
				language: undefined,
				filePath: ["file with spaces"],
				itemLogicPath: ["dir", "file with spaces"],
				repNameItemLogicPath: ["repo", "file with spaces"],
				hash: "",
				isPublic: false,
			};

			const result = RouterPathProvider.getPathname(data);

			expect(result.value).toBe("source%20name/group%20name/repo/branch%20name/dir/file with spaces");
		});

		it("должен обрабатывать отсутствующие компоненты с сепараторами", () => {
			const data = {
				sourceName: "source",
				group: null,
				repo: "repo",
				refname: null,
				catalogName: "dir",
				language: undefined,
				filePath: ["file"],
				itemLogicPath: ["dir", "file"],
				repNameItemLogicPath: ["repo", "file"],
				hash: "",
				isPublic: false,
			};

			const result = RouterPathProvider.getPathname(data);

			expect(result.value).toBe("source/-/repo/-/dir/file");
		});

		it("должен обрабатывать catalogName равный repo", () => {
			const data = {
				sourceName: "source",
				group: "group",
				repo: "repo",
				refname: "branch",
				catalogName: "repo",
				language: undefined,
				filePath: ["file"],
				itemLogicPath: ["repo", "file"],
				repNameItemLogicPath: ["repo", "file"],
				hash: "",
				isPublic: false,
			};

			const result = RouterPathProvider.getPathname(data);

			expect(result.value).toBe("source/group/repo/branch/-/file");
		});

		it("должен обрабатывать отсутствующий filePath", () => {
			const data = {
				sourceName: "source",
				group: "group",
				repo: "repo",
				refname: "branch",
				catalogName: "dir",
				language: undefined,
				filePath: [],
				itemLogicPath: ["dir"],
				repNameItemLogicPath: ["repo"],
				hash: "",
				isPublic: false,
			};

			const result = RouterPathProvider.getPathname(data);

			expect(result.value).toBe("source/group/repo/branch/dir");
		});

		it("должен генерировать путь с сепараторами в формате из getPageDataByPathname.test.ts", () => {
			const data = {
				sourceName: null,
				group: null,
				repo: null,
				refname: null,
				catalogName: "local_catalog",
				language: undefined,
				filePath: ["file"],
				itemLogicPath: ["local_catalog", "file"],
				repNameItemLogicPath: null,
				hash: "",
				isPublic: false,
			};

			const result = RouterPathProvider.getPathname(data);

			expect(result.value).toBe("-/-/-/-/local_catalog/file");
		});
	});

	describe("getLogicPath", () => {
		it("должен возвращать itemLogicPath для путей редактора", () => {
			const result = RouterPathProvider.getLogicPath("dir/file");

			expect(result).toBe("dir/file");
		});

		it("должен возвращать оригинальный путь для путей не редактора", () => {
			const result = RouterPathProvider.getLogicPath("source/group/repo/branch/dir/file");

			expect(result).toBe("source/group/repo/branch/dir/file");
		});

		it("должен возвращать itemLogicPath для путей редактора с сепараторами", () => {
			const result = RouterPathProvider.getLogicPath("-/-/-/-/local_catalog/file");

			expect(result).toBe("local_catalog/file");
		});
	});

	describe("parseItemLogicPath", () => {
		it("должен разбирать путь логики элемента", () => {
			const result = RouterPathProvider.parseItemLogicPath(["dir", "file"]);

			expect(result).toEqual({
				catalogName: "dir",
				filePath: ["file"],
				fullPath: ["dir", "file"],
			});
		});

		it("должен разбирать путь логики элемента с несколькими сегментами пути к файлу", () => {
			const result = RouterPathProvider.parseItemLogicPath(["dir", "subdir", "file"]);

			expect(result).toEqual({
				catalogName: "dir",
				filePath: ["subdir", "file"],
				fullPath: ["dir", "subdir", "file"],
			});
		});
	});

	describe("isEditorPathname", () => {
		it("должен возвращать true для путей редактора", () => {
			expect(RouterPathProvider.isEditorPathname("-/-/-/-/local_catalog/file")).toBe(true);
			expect(RouterPathProvider.isEditorPathname("-/-/-/-/local_catalog_not_in_lib")).toBe(true);

			expect(RouterPathProvider.isEditorPathname("github.com/user/repo/master/-/file")).toBe(true);
			expect(RouterPathProvider.isEditorPathname("test.local/group/repo/-/-/file")).toBe(true);

			// Desktop (Tauri) links carry the app origin `tauri://localhost/...`
			expect(RouterPathProvider.isEditorPathname("tauri://localhost/github.com/user/repo/master/-/file")).toBe(
				true,
			);
		});

		it("должен возвращать false для путей не редактора", () => {
			// Пути начинающиеся с имени без точки и не сепаратора
			expect(RouterPathProvider.isEditorPathname("source/group/repo/branch/dir/file")).toBe(false);
			expect(RouterPathProvider.isEditorPathname("catalog/subdir/file")).toBe(false);
		});

		it("должен распознавать bare host:port без точки как путь редактора (gh#926)", () => {
			// Внутренний Gitea по короткому DNS-алиасу: host:port без точки в хосте
			expect(RouterPathProvider.isEditorPathname("gitea-server:3000/user/repo/master/-/file")).toBe(true);
			// host:port без точки без -сепаратора тоже внешний источник
			expect(RouterPathProvider.isEditorPathname("gitea-server:3000/user/repo/branch/dir/file")).toBe(true);
			// имя с двоеточием, но без числового порта — не источник, остаётся локальным
			expect(RouterPathProvider.isEditorPathname("catalog:draft/subdir/file")).toBe(false);
		});
	});

	describe("parsePath bare host:port (gh#926)", () => {
		it("должен разбирать host:port без точки как внешний источник", () => {
			const result = RouterPathProvider.parsePath("gitea-server:3000/user/repo/master/-/file");

			expect(result.sourceName).toBe("gitea-server:3000");
			expect(result.group).toBe("user");
			expect(result.repo).toBe("repo");
			expect(result.refname).toBe("master");
			expect(result.filePath).toEqual(["file"]);
			expect(RouterPathProvider.validate(result)).toBe(true);
		});
	});

	describe("updatePathnameData", () => {
		it("должен обновлять данные пути новыми значениями", () => {
			const basePathname = "source/group/repo/branch/dir/file";
			const newPathnameData = {
				refname: "new-branch",
				filePath: ["new-file"],
			};

			const result = RouterPathProvider.updatePathnameData(basePathname, newPathnameData);

			expect(result.value).toBe("-/-/-/new-branch/source/new-file");
		});

		it("должен обновлять данные пути с объектом Path", () => {
			const basePathname = new Path("source/group/repo/branch/dir/file");
			const newPathnameData = {
				refname: "new-branch",
				filePath: ["new-file"],
			};

			const result = RouterPathProvider.updatePathnameData(basePathname, newPathnameData);

			expect(result.value).toBe("-/-/-/new-branch/source/new-file");
		});

		it("должен обновлять данные пути с массивом", () => {
			const basePathname = ["source", "group", "repo", "branch", "dir", "file"];
			const newPathnameData = {
				refname: "new-branch",
				filePath: ["new-file"],
			};

			const result = RouterPathProvider.updatePathnameData(basePathname, newPathnameData);

			expect(result.value).toBe("-/-/-/new-branch/source/new-file");
		});

		it("должен обновлять данные пути с сепараторами", () => {
			const basePathname = "-/-/-/-/local_catalog/file";
			const newPathnameData = {
				filePath: ["new-file"],
			};

			const result = RouterPathProvider.updatePathnameData(basePathname, newPathnameData);

			expect(result.value).toBe("-/-/-/-/local_catalog/new-file");
		});
	});

	describe("validate", () => {
		it("должен возвращать true для валидных данных пути", () => {
			const data = {
				sourceName: "source",
				group: "group",
				repo: "repo",
				refname: "branch",
				catalogName: "dir",
				language: undefined,
				filePath: ["file"],
				itemLogicPath: ["dir", "file"],
				repNameItemLogicPath: ["repo", "file"],
				hash: "",
				isPublic: false,
			};

			expect(RouterPathProvider.validate(data)).toBe(true);
		});

		it("должен возвращать false для невалидных данных пути", () => {
			const data = {
				sourceName: null,
				group: "group",
				repo: "repo",
				refname: "branch",
				catalogName: "dir",
				language: undefined,
				filePath: ["file"],
				itemLogicPath: ["dir", "file"],
				repNameItemLogicPath: ["repo", "file"],
				hash: "",
				isPublic: false,
			};

			expect(RouterPathProvider.validate(data)).toBe(false);
		});
	});

	describe("isLocal", () => {
		it("должен возвращать true для локальных данных пути", () => {
			const data = {
				sourceName: null,
				group: null,
				repo: null,
				refname: "branch",
				catalogName: "dir",
				language: undefined,
				filePath: ["file"],
				itemLogicPath: ["dir", "file"],
				repNameItemLogicPath: null,
				hash: "",
				isPublic: false,
			};

			expect(RouterPathProvider.isLocal(data)).toBe(true);
		});

		it("должен возвращать false для не локальных данных пути", () => {
			const data = {
				sourceName: "source",
				group: "group",
				repo: "repo",
				refname: "branch",
				catalogName: "dir",
				language: undefined,
				filePath: ["file"],
				itemLogicPath: ["dir", "file"],
				repNameItemLogicPath: ["repo", "file"],
				hash: "",
				isPublic: false,
			};

			expect(RouterPathProvider.isLocal(data)).toBe(false);
		});
	});
});
