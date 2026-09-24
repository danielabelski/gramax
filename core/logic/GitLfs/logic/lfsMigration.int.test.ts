/** biome-ignore-all lint/suspicious/noExplicitAny: minimal Catalog/Workspace stubs for int harness */
/**
 * @jest-environment node
 */

import { execSync } from "node:child_process";
import DiskFileProvider from "@core/FileProvider/DiskFileProvider/DiskFileProvider";
import Path from "@core/FileProvider/Path/Path";
import { applyLfsMigration, getLfsMigrationStats } from "@core/GitLfs/logic/lfsMigration";
import GitCommands from "@ext/git/core/GitCommands/GitCommands";
import GitStorage from "@ext/git/core/GitStorage/GitStorage";
import GitVersionControl from "@ext/git/core/GitVersionControl/GitVersionControl";
import RepositoryProvider from "@ext/git/core/Repository/RepositoryProvider";
import WorkdirRepository from "@ext/git/core/Repository/WorkdirRepository";
import type SourceData from "@ext/storage/logic/SourceDataProvider/model/SourceData";
import SourceType from "@ext/storage/logic/SourceDataProvider/model/SourceType";

const pushMock = jest.spyOn(GitStorage.prototype, "push").mockImplementation(() => Promise.resolve());
jest.spyOn(GitCommands.prototype, "fetch").mockImplementation(() => Promise.resolve());

const mockUserData: SourceData = {
	sourceType: SourceType.gitHub,
	userEmail: "test-email@email.com",
	userName: "test user",
};

const REPO = "testLfsMigrationRep";
// The engine takes the wording from its caller, so the test brings its own and asserts on it.
const MESSAGE = "chore: the caller's own words";

const path = (p: string) => new Path(p);
const repPath = (p: string) => new Path([REPO, p]);
const dfp = new DiskFileProvider(__dirname);
const sh = (cmd: string) => execSync(cmd, { cwd: dfp.rootPath.join(path(REPO)).value }).toString();
const isLfsPointer = (file: string) =>
	sh(`git show HEAD:${file}`).includes("version https://git-lfs.github.com/spec/v1");

let repo: WorkdirRepository;

const makeCatalog = () =>
	({ repo, getRootCategoryPath: () => path(REPO), getRelativeRootCategoryPath: () => new Path("") }) as any;

const makeWorkspace = () => ({ config: () => Promise.resolve({}), getFileProvider: () => dfp }) as any;

describe("lfsMigration", () => {
	beforeEach(async () => {
		await RepositoryProvider.resetRepo();
		await dfp.mkdir(path(REPO));
		await GitVersionControl.init(dfp, path(REPO), mockUserData);
		const gvc = new GitVersionControl(path(REPO), dfp);
		const storage = new GitStorage(path(REPO), dfp);
		repo = new WorkdirRepository(path(REPO), dfp, gvc, storage);
		await dfp.write(repPath("article.md"), "# hi");
		await repo.publish({ commitMessage: "init", data: mockUserData, filesToPublish: [path("article.md")] });
		pushMock.mockClear();
	});

	afterEach(async () => {
		await RepositoryProvider.resetRepo();
		await dfp.delete(path(REPO));
		repo = null;
	});

	test("migrates the attachments the patterns cover and commits them separately", async () => {
		await dfp.write(repPath("docs/a.psd"), "A".repeat(2048));
		await dfp.write(repPath("docs/b.png"), "B".repeat(2048));
		await repo.publish({
			commitMessage: "attachments",
			data: mockUserData,
			filesToPublish: [path("docs/a.psd"), path("docs/b.png")],
		});

		await applyLfsMigration(makeWorkspace(), makeCatalog(), mockUserData, ["*.psd", "*.png"], MESSAGE);

		expect(isLfsPointer("docs/a.psd")).toBe(true);
		expect(isLfsPointer("docs/b.png")).toBe(true);
		expect(sh("git log -1 --pretty=%s").trim()).toBe(MESSAGE);
	});

	test("an unrelated dirty file is not swept into the migration commit", async () => {
		await dfp.write(repPath("docs/a.psd"), "A".repeat(2048));
		await repo.publish({ commitMessage: "attachment", data: mockUserData, filesToPublish: [path("docs/a.psd")] });
		await dfp.write(repPath("article.md"), "# edited, not published");

		await applyLfsMigration(makeWorkspace(), makeCatalog(), mockUserData, ["*.psd"], MESSAGE);

		expect(sh("git show HEAD:article.md")).toBe("# hi");
	});

	test("reports the landed commit through onCommitted when the push then fails", async () => {
		await dfp.write(repPath("docs/a.psd"), "A".repeat(2048));
		await repo.publish({ commitMessage: "attachment", data: mockUserData, filesToPublish: [path("docs/a.psd")] });
		pushMock.mockImplementationOnce(() => Promise.reject(new Error("push rejected")));
		const onCommitted = jest.fn();

		await expect(
			applyLfsMigration(makeWorkspace(), makeCatalog(), mockUserData, ["*.psd"], MESSAGE, { onCommitted }),
		).rejects.toThrow("push rejected");

		expect(onCommitted).toHaveBeenCalledTimes(1);
		expect(isLfsPointer("docs/a.psd")).toBe(true);
	});

	test("a *.yaml mask leaves the catalog's own config out of LFS", async () => {
		await dfp.write(repPath(".doc-root.yaml"), `title: ${REPO}\n`);
		await dfp.write(repPath("docs/_index.md"), "---\ntitle: docs\n---\n");
		await dfp.write(repPath("docs/diagram.yaml"), "Y".repeat(2048));
		await repo.publish({
			commitMessage: "config, category root and a diagram",
			data: mockUserData,
			filesToPublish: [path(".doc-root.yaml"), path("docs/_index.md"), path("docs/diagram.yaml")],
		});

		await applyLfsMigration(makeWorkspace(), makeCatalog(), mockUserData, ["*.yaml", "*.md"], MESSAGE);

		expect(isLfsPointer("docs/diagram.yaml")).toBe(true);
		expect(isLfsPointer(".doc-root.yaml")).toBe(false);
		expect(isLfsPointer("docs/_index.md")).toBe(false);
		expect(sh("git show HEAD:.doc-root.yaml")).toContain(`title: ${REPO}`);
	});

	test("a hand-written *.md mask does not drag articles into the migration commit", async () => {
		await dfp.write(repPath("docs/note.md"), "N".repeat(2048));
		await dfp.write(repPath("docs/a.psd"), "A".repeat(2048));
		await repo.publish({
			commitMessage: "an article and an attachment",
			data: mockUserData,
			filesToPublish: [path("docs/note.md"), path("docs/a.psd")],
		});

		await applyLfsMigration(makeWorkspace(), makeCatalog(), mockUserData, ["*.md", "*.psd"], MESSAGE);

		expect(isLfsPointer("docs/a.psd")).toBe(true);
		expect(isLfsPointer("docs/note.md")).toBe(false);
		expect(isLfsPointer("article.md")).toBe(false);
		expect(sh("git show HEAD:docs/note.md")).toBe("N".repeat(2048));
	});

	test("no patterns means no commit at all, extra files included", async () => {
		await dfp.write(repPath(".doc-root.yaml"), `title: ${REPO}\nlfs:\n  auto: true\n`);
		const before = sh("git rev-parse HEAD").trim();

		await applyLfsMigration(makeWorkspace(), makeCatalog(), mockUserData, [], MESSAGE, {
			extraFiles: [path(".doc-root.yaml")],
		});

		expect(sh("git rev-parse HEAD").trim()).toBe(before);
		expect(sh("git status --porcelain")).toContain(".doc-root.yaml");
	});

	describe("what the working copy still owes the remote stays the user's", () => {
		const migrate = (patterns: string[]) =>
			applyLfsMigration(makeWorkspace(), makeCatalog(), mockUserData, patterns, MESSAGE);

		const commitFiles = () =>
			sh("git show --name-only --pretty=format: HEAD")
				.split("\n")
				.map((line) => line.trim())
				.filter(Boolean)
				.sort();

		const publishedAttachment = async () => {
			await dfp.write(repPath("docs/a.psd"), "A".repeat(2048));
			await repo.publish({
				commitMessage: "attachment",
				data: mockUserData,
				filesToPublish: [path("docs/a.psd")],
			});
		};

		test("what HEAD holds unchanged is what moves", async () => {
			await publishedAttachment();

			await migrate(["*.psd"]);

			expect(commitFiles()).toEqual([".gitattributes", "docs/a.psd"]);
			expect(isLfsPointer("docs/a.psd")).toBe(true);
		});

		test("an attachment edited but not published keeps its edit and stays out", async () => {
			await publishedAttachment();
			await dfp.write(repPath("docs/a.psd"), "E".repeat(4096));

			await migrate(["*.psd"]);

			expect(commitFiles()).toEqual([".gitattributes"]);
			expect(await dfp.read(repPath("docs/a.psd"))).toBe("E".repeat(4096));
		});

		test("an attachment written and never published stays out too", async () => {
			await dfp.write(repPath("docs/fresh.psd"), "F".repeat(2048));

			await migrate(["*.psd"]);

			expect(commitFiles()).toEqual([".gitattributes"]);
			expect(await dfp.read(repPath("docs/fresh.psd"))).toBe("F".repeat(2048));
		});

		test("and it reaches LFS on the user's own next publish, which is the whole promise", async () => {
			await dfp.write(repPath("docs/fresh.psd"), "F".repeat(2048));

			await migrate(["*.psd"]);
			await repo.publish({
				commitMessage: "mine",
				data: mockUserData,
				filesToPublish: [path("docs/fresh.psd")],
			});

			expect(isLfsPointer("docs/fresh.psd")).toBe(true);
			expect(await dfp.read(repPath("docs/fresh.psd"))).toBe("F".repeat(2048));
		});

		test("the dialog counts only what moves, so its number is the one the commit carries", async () => {
			await publishedAttachment();
			await dfp.write(repPath("docs/fresh.psd"), "F".repeat(1024));

			expect(await getLfsMigrationStats(makeWorkspace(), makeCatalog(), ["*.psd"])).toEqual({
				fileCount: 1,
				totalSize: 2048,
			});
		});

		test("a pending article is nobody's to publish either", async () => {
			await publishedAttachment();
			await dfp.write(repPath("article.md"), "# half-written");
			await dfp.write(repPath("docs/draft.md"), "# never published");

			await migrate(["*.md", "*.psd"]);

			expect(commitFiles()).toEqual([".gitattributes", "docs/a.psd"]);
			expect(sh("git show HEAD:article.md")).toBe("# hi");
			expect(await dfp.read(repPath("docs/draft.md"))).toBe("# never published");
		});

		test("a pending file no mask covers stays pending", async () => {
			await publishedAttachment();
			await dfp.write(repPath("docs/notes.txt"), "T".repeat(2048));

			await migrate(["*.psd"]);

			expect(commitFiles()).toEqual([".gitattributes", "docs/a.psd"]);
			expect(sh("git status --porcelain")).toContain("docs/notes.txt");
		});

		test("a deleted attachment is not resurrected into the service commit", async () => {
			await publishedAttachment();
			await dfp.write(repPath("docs/gone.psd"), "G".repeat(2048));
			await repo.publish({
				commitMessage: "attachments",
				data: mockUserData,
				filesToPublish: [path("docs/gone.psd")],
			});
			await dfp.delete(repPath("docs/gone.psd"));

			await migrate(["*.psd"]);

			expect(commitFiles()).toEqual([".gitattributes", "docs/a.psd"]);
			expect(sh("git status --porcelain")).toContain("docs/gone.psd");
		});
	});

	test("carries the caller's extra files in the same commit as the masks", async () => {
		await dfp.write(repPath("docs/a.psd"), "A".repeat(2048));
		await repo.publish({ commitMessage: "attachment", data: mockUserData, filesToPublish: [path("docs/a.psd")] });
		await dfp.write(repPath(".doc-root.yaml"), `title: ${REPO}\nlfs:\n  auto: true\n`);

		await applyLfsMigration(makeWorkspace(), makeCatalog(), mockUserData, ["*.psd"], MESSAGE, {
			extraFiles: [path(".doc-root.yaml")],
		});

		expect(sh("git show HEAD:.doc-root.yaml")).toContain("auto: true");
		expect(sh("git show --name-only --pretty=format: HEAD")).toContain(".gitattributes");
		expect(sh("git status --porcelain")).not.toContain(".doc-root.yaml");
	});
});
