/** biome-ignore-all lint/suspicious/noExplicitAny: minimal Catalog stub for the int harness */
/**
 * @jest-environment node
 */

import { execSync } from "node:child_process";
import DiskFileProvider from "@core/FileProvider/DiskFileProvider/DiskFileProvider";
import Path from "@core/FileProvider/Path/Path";
import { ensureLfsPatternForResource } from "@core/GitLfs/logic/ensureLfsPatternForResource";
import GitCommands from "@ext/git/core/GitCommands/GitCommands";
import GitStorage from "@ext/git/core/GitStorage/GitStorage";
import GitVersionControl from "@ext/git/core/GitVersionControl/GitVersionControl";
import RepositoryProvider from "@ext/git/core/Repository/RepositoryProvider";
import WorkdirRepository from "@ext/git/core/Repository/WorkdirRepository";
import type SourceData from "@ext/storage/logic/SourceDataProvider/model/SourceData";
import SourceType from "@ext/storage/logic/SourceDataProvider/model/SourceType";

jest.spyOn(GitStorage.prototype, "push").mockImplementation(() => Promise.resolve());
jest.spyOn(GitCommands.prototype, "fetch").mockImplementation(() => Promise.resolve());

const mockUserData: SourceData = {
	sourceType: SourceType.gitHub,
	userEmail: "test-email@email.com",
	userName: "test user",
};

const REPO = "testAutoLfsRep";

const path = (p: string) => new Path(p);
const repPath = (p: string) => new Path([REPO, p]);
const dfp = new DiskFileProvider(__dirname);
const sh = (cmd: string) => execSync(cmd, { cwd: dfp.rootPath.join(path(REPO)).value }).toString();
const stagedFiles = () => sh("git diff --cached --name-only").split("\n").filter(Boolean).sort();

let repo: WorkdirRepository;

describe("gitattributes staging", () => {
	beforeEach(async () => {
		await RepositoryProvider.resetRepo();
		await dfp.mkdir(path(REPO));
		await GitVersionControl.init(dfp, path(REPO), mockUserData);
		const gvc = new GitVersionControl(path(REPO), dfp);
		const storage = new GitStorage(path(REPO), dfp);
		repo = new WorkdirRepository(path(REPO), dfp, gvc, storage);
		await dfp.write(repPath("article.md"), "# hi");
		await repo.publish({ commitMessage: "init", data: mockUserData, filesToPublish: [path("article.md")] });
	});

	afterEach(async () => {
		await RepositoryProvider.resetRepo();
		await dfp.delete(path(REPO));
		repo = null;
	});

	test("saving attributes stages .gitattributes without an explicit add", async () => {
		const attributes = await repo.attributes(path(REPO));
		await attributes.setAttr("*.psd", "filter=lfs").save();

		expect(stagedFiles()).toEqual([".gitattributes"]);
	});

	test("saving with nothing changed stages nothing", async () => {
		const attributes = await repo.attributes(path(REPO));
		await attributes.save();

		expect(stagedFiles()).toEqual([]);
	});
});

describe("ensureLfsPatternForResource", () => {
	beforeEach(async () => {
		await RepositoryProvider.resetRepo();
		await dfp.mkdir(path(REPO));
		await GitVersionControl.init(dfp, path(REPO), mockUserData);
		const gvc = new GitVersionControl(path(REPO), dfp);
		const storage = new GitStorage(path(REPO), dfp);
		repo = new WorkdirRepository(path(REPO), dfp, gvc, storage);
		await dfp.write(repPath("article.md"), "# hi");
		await repo.publish({ commitMessage: "init", data: mockUserData, filesToPublish: [path("article.md")] });
	});

	afterEach(async () => {
		await RepositoryProvider.resetRepo();
		await dfp.delete(path(REPO));
		repo = null;
	});

	const makeCatalog = (lfs?: { auto?: boolean; exclude?: string[] }) =>
		({ props: { lfs }, repo, getRootCategoryPath: () => path(REPO) }) as any;

	const makeWorkspace = (patterns?: string[]) =>
		({ config: () => Promise.resolve(patterns ? { git: { lfs: { patterns } } } : {}) }) as any;

	const plainWorkspace = makeWorkspace();

	const ensure = (catalog: any, resource: Path, workspace: any = plainWorkspace) =>
		ensureLfsPatternForResource(workspace, catalog, resource);

	const attrs = async () =>
		(await dfp.exists(repPath(".gitattributes"))) ? await dfp.read(repPath(".gitattributes")) : "";

	test("adds the extension mask for a new attachment type", async () => {
		const added = await ensure(makeCatalog({ auto: true }), repPath("docs/schema.psd"));

		expect(added).toBe(true);
		expect(await attrs()).toContain("*.psd filter=lfs");
	});

	test("does nothing when the switch is off", async () => {
		const added = await ensure(makeCatalog({ auto: false }), repPath("docs/schema.psd"));

		expect(added).toBe(false);
		expect(await attrs()).toBe("");
	});

	test("does nothing for a catalog that has no lfs block at all", async () => {
		const added = await ensure(makeCatalog(undefined), repPath("docs/schema.psd"));

		expect(added).toBe(false);
		expect(await attrs()).toBe("");
	});

	test("mints nothing when the workspace manages the masks, however the switch is stored", async () => {
		const managed = makeWorkspace(["*.png"]);

		const added = await ensure(makeCatalog({ auto: true }), repPath("docs/schema.psd"), managed);

		expect(added).toBe(false);
		expect(await attrs()).toBe("");
	});

	test("does not duplicate a mask that already exists", async () => {
		await dfp.write(repPath(".gitattributes"), "*.psd filter=lfs\n");

		const added = await ensure(makeCatalog({ auto: true }), repPath("docs/schema.psd"));

		expect(added).toBe(false);
		expect((await attrs()).match(/\*\.psd/g)).toHaveLength(1);
	});

	test("respects the exclusion list", async () => {
		const catalog = makeCatalog({ auto: true, exclude: ["*.svg"] });

		const added = await ensure(catalog, repPath("docs/diagram.svg"));

		expect(added).toBe(false);
		expect(await attrs()).toBe("");
	});

	test("parallel writes of different types keep every mask", async () => {
		const catalog = makeCatalog({ auto: true });

		await Promise.all([
			ensure(catalog, repPath("a.psd")),
			ensure(catalog, repPath("b.blend")),
			ensure(catalog, repPath("c.step")),
		]);

		const content = await attrs();
		expect(content).toContain("*.psd filter=lfs");
		expect(content).toContain("*.blend filter=lfs");
		expect(content).toContain("*.step filter=lfs");
	});

	test("an attachment committed after the mask lands in the tree as an LFS pointer", async () => {
		const catalog = makeCatalog({ auto: true });
		await ensure(catalog, repPath("docs/schema.psd"));
		await dfp.write(repPath("docs/schema.psd"), "P".repeat(2048));

		await repo.publish({
			commitMessage: "attach",
			data: mockUserData,
			filesToPublish: [path(".gitattributes"), path("docs/schema.psd")],
		});

		expect(sh("git show HEAD:docs/schema.psd")).toContain("version https://git-lfs.github.com/spec/v1");
	});

	test("the attachment is a pointer even when .gitattributes is not in filesToPublish", async () => {
		const catalog = makeCatalog({ auto: true });
		await ensure(catalog, repPath("docs/schema.psd"));
		await dfp.write(repPath("docs/schema.psd"), "P".repeat(2048));

		await repo.publish({
			commitMessage: "attach",
			data: mockUserData,
			filesToPublish: [path("docs/schema.psd")],
		});

		expect(sh("git show HEAD:docs/schema.psd")).toContain("version https://git-lfs.github.com/spec/v1");
	});
});
