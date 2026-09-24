import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect } from "@playwright/test";
import { getSourceDataFromEnv, getTestRepoInfoFromEnv } from "@utils/source";
import { homeTest as test } from "@web/fixtures/home.fixture";
import CatalogPage from "@web/pom/catalog.page";
import { ClonePom } from "@web/pom/clone.pom";
import { ArticleEditorPom } from "@web/pom/editor.pom";
import { discardAllChanges } from "@web/tests/features/git/stash/stash-helpers";
import { workspacePlugins } from "@web/tests/features/plugins/helpers";

const pluginRoot = fileURLToPath(
	new URL("../../../../../../../plugins/examples/branch-checkout-guard", import.meta.url),
);

const pluginId = "branch-checkout-guard";
const pluginBundle = `
import { Plugin } from "@gramax/sdk";
import { t } from "@gramax/sdk/localization";
import { Modal } from "@gramax/sdk/ui";

export default class BranchCheckoutGuardPlugin extends Plugin {
  onload() {
    this.ctx.events.on("git:branch:before-checkout", async ({ catalogName }) => {
      try {
        const changes = await this.ctx.commands.execute("versionControl/statuses", { catalogName });
        if (changes.length === 0) return;
        const modal = new Modal({
          title: t("branch-checkout-guard.title"),
          content: t("branch-checkout-guard.local-changes-description") + " " + t("branch-checkout-guard.local-changes-action"),
          status: "default",
          secondaryButtonProps: {
            text: t("branch-checkout-guard.close"),
            onClick: () => modal.close(),
          },
        });
        modal.open();
      } catch {
        const modal = new Modal({
          title: t("branch-checkout-guard.title"),
          content: t("branch-checkout-guard.check-failed-description") + " " + t("branch-checkout-guard.check-failed-action"),
          status: "default",
          secondaryButtonProps: {
            text: t("branch-checkout-guard.close"),
            onClick: () => modal.close(),
          },
        });
        modal.open();
      }
      return false;
    });
  }
}
`.trim();
const pluginManifest = readFileSync(`${pluginRoot}/manifest.json`, "utf8");
const pluginLocaleText = readFileSync(`${pluginRoot}/locale.json`, "utf8");
const pluginLocale = JSON.parse(pluginLocaleText) as Record<string, Record<string, string>>;

test.use({
	files: workspacePlugins({
		[pluginId]: {
			"manifest.json": pluginManifest,
			[`${pluginId}.js`]: pluginBundle,
			"locale.json": pluginLocaleText,
		},
	}),
	isolated: false,
	source: "env",
});
test.describe.configure({ mode: "serial" });

const branch = "x";

test.describe("checkout guard plugin", () => {
	test("clones the test catalog with the checkout guard plugin", async ({ homePage, sharedPage }) => {
		const source = getSourceDataFromEnv();
		const repo = getTestRepoInfoFromEnv();
		const clone = new ClonePom(homePage);
		await clone.cloneCatalog({ storage: source.domain, group: repo.group, repo: repo.testRepo });
		await clone.openCatalog("Автотест");
		await expect(sharedPage).toHaveURL(new RegExp(`/${repo.testRepo}/master/-`));
	});

	test("blocks checkout with local changes and allows a clean checkout", async ({
		homePage,
		baseURL,
		sharedPage,
	}) => {
		const catalogPage = new CatalogPage(sharedPage, baseURL!);
		await new ClonePom(homePage).openCatalog("Автотест");

		const editor = new ArticleEditorPom(catalogPage);
		const git = catalogPage.git();
		await editor.rewrite("Uncommitted change");

		await git.openBranches();
		await git.branchItem(branch).click();
		const localChangesMessage = sharedPage.getByText(
			`${pluginLocale.en["branch-checkout-guard.local-changes-description"]} ${
				pluginLocale.en["branch-checkout-guard.local-changes-action"]
			}`,
			{ exact: true },
		);
		await expect(localChangesMessage).toBeVisible();
		expect(catalogPage.url).not.toContain(":");

		await sharedPage.getByRole("button", { name: pluginLocale.en["branch-checkout-guard.close"] }).click();
		await expect(localChangesMessage).toBeHidden();
		await git.closeBranches();
		await discardAllChanges(sharedPage, getTestRepoInfoFromEnv().testRepo);
		await sharedPage.reload();
		await catalogPage.waitForLoad();

		await git.openBranches();
		await git.branchItem(branch).click();
		await expect(localChangesMessage).toBeHidden();
		await git.assertCurrentBranch(branch);
	});
});
