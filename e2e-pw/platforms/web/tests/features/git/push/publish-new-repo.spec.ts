import { expect } from "@playwright/test";
import { listGroupProjects } from "@utils/gitlab";
import { getSourceDataFromEnv, getTestRepoInfoFromEnv } from "@utils/source";
import { gitTest as test } from "@web/fixtures/git.fixture";
import { setStorage } from "@web/utils";
import { catalogFiles, localCatalogUrl } from "../catalog-setup";

test.use({ isolated: false });
test.describe.configure({ mode: "serial" });

const source = getSourceDataFromEnv();
const repo = getTestRepoInfoFromEnv();

test.describe("create a repository from a catalog", () => {
	test("connecting a storage creates the repository and pushes the catalog", async ({
		catalogPage,
		sharedPage,
		tempRepoName,
	}) => {
		await catalogPage.createFileTree(sharedPage, catalogFiles(tempRepoName));
		await setStorage(sharedPage, source);

		await catalogPage.goto(localCatalogUrl(tempRepoName));
		await catalogPage.waitForLoad();

		const git = catalogPage.git();
		await expect(git.connectStorageTrigger).toBeVisible();

		await git.connectStorage({ group: repo.tempGroup, storage: source.domain });

		// A linked catalog leaves the local `/-/-/-/-/` form for the git one.
		await sharedPage.waitForURL((url) => url.pathname.startsWith(`/${repo.host}/`), { timeout: 120_000 });
		await catalogPage.waitForLoad();

		await git.assertCurrentBranch("master");
		await git.assertNothingToPublish();

		const projects = await listGroupProjects(repo.tempGroup);
		expect(projects.map((project) => project.path_with_namespace)).toContain(`${repo.tempGroup}/${tempRepoName}`);
	});

	test("a repository that already exists is refused", async ({ catalogPage, sharedPage, tempRepo }) => {
		await catalogPage.createFileTree(sharedPage, catalogFiles(tempRepo.name));
		await setStorage(sharedPage, source);

		await catalogPage.goto(localCatalogUrl(tempRepo.name));
		await catalogPage.waitForLoad();

		const git = catalogPage.git();
		await git.connectStorage({ group: tempRepo.group, storage: source.domain });

		await expect(catalogPage.modal.getByText("Such a catalog already exists")).toBeVisible({ timeout: 60_000 });

		// Nothing was linked: the catalog is still local.
		expect(catalogPage.url).toContain(localCatalogUrl(tempRepo.name));
	});
});
