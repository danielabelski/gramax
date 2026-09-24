import type GitStorageData from "@gramax/core/extensions/git/core/model/GitStorageData";
import type { Page } from "@playwright/test";
import { commitFiles, createProject, deleteProject, nextTempRepoName, type TempRepo } from "@utils/gitlab";
import { getSourceDataFromEnv, getTestRepoInfoFromEnv } from "@utils/source";
import { catalogTest } from "./catalog.fixture";

/** Tree the worker-scoped temp repo is seeded with — a minimal, valid Gramax catalog. */
export const TEMP_REPO_FILES: Record<string, string> = {
	".doc-root.yaml": "title: E2E Temp Catalog\n",
	"index.md": "---\ntitle: Index\n---\n\nSeeded by the e2e temp repo fixture.\n",
};

export const gitTest = catalogTest.extend<{ tempRepoName: string }, { tempRepo: TempRepo }>({
	/**
	 * A GitLab project that already exists and carries the seed tree. Created once per worker and
	 * deleted when the worker ends.
	 */
	tempRepo: [
		// biome-ignore lint/correctness/noEmptyPattern: Playwright requires the object-destructuring form even with no fixtures used
		async ({}, use, workerInfo) => {
			const repo = await createProject(nextTempRepoName(workerInfo.workerIndex));
			await commitFiles(repo.id, TEMP_REPO_FILES, "seed e2e temp catalog");

			await use(repo);

			// Best effort: a teardown that throws is reported as an error outside any test and fails
			// the whole run, and losing a throwaway repo is not a test result. The scheduled
			// `e2e-temp-cleanup` sweeps whatever is left behind.
			try {
				await deleteProject(repo.id);
			} catch (e) {
				console.warn(`temp repo teardown: cannot delete ${repo.group}/${repo.name}: ${String(e)}`);
			}
		},
		{ scope: "worker" },
	],

	/**
	 * Only a free repo name, for scenarios where the project must appear through Gramax itself
	 * (push-to-create). Nothing is created here; the global teardown collects whatever appears.
	 */
	// biome-ignore lint/correctness/noEmptyPattern: Playwright requires the object-destructuring form even with no fixtures used
	tempRepoName: async ({}, use, testInfo) => {
		await use(nextTempRepoName(testInfo.workerIndex));
	},
});

/** Connects an existing local catalog to `<GX_E2E_GIT_TEMP_GROUP>/<repoName>`. */
export const linkCatalogToRepo = async (
	page: Page,
	{ catalogName, repoName }: { catalogName: string; repoName: string },
): Promise<void> => {
	const data: GitStorageData = {
		group: getTestRepoInfoFromEnv().tempGroup,
		name: repoName,
		source: getSourceDataFromEnv(),
	};

	try {
		await page.evaluate(
			async ({ catalogName, data }) => {
				const app = await window.app!;
				const ctx = await app.contextFactory.fromWeb({ language: "ru" });
				const commands = await window.debug.commands();
				// `storage/init` by route, but the tree hangs it off versionControl.
				await commands.versionControl.init.do({ catalogName, ctx, data });
			},
			{ catalogName, data },
		);
	} catch (e) {
		// `storage/init` has no create-repository call: it pushes, and GitLab creates the project on
		// the first push. A token that may read but not create projects gets a plain 404 back from
		// that push, which Gramax reports as a missing repository — true, and useless as a lead.
		// Say what it actually takes, so the next person does not go looking in the suite.
		if (String(e).includes("Failed to find repository"))
			throw new Error(
				`${String(e)}\n\nLinking pushes into a repository that does not exist yet, so ` +
					`GX_E2E_GIT_TOKEN has to be allowed to create projects in ${data.group} — and to ` +
					`delete them, or every run leaves its repos behind. Check the token's role before ` +
					`suspecting the test: a read-only one fails exactly like this.`,
			);
		throw e;
	}
};

/** Commits and pushes everything pending in the catalog. */
export const publishCatalog = async (
	page: Page,
	{ catalogName, message }: { catalogName: string; message: string },
): Promise<void> => {
	await page.evaluate(
		async ({ catalogName, message }) => {
			const app = await window.app!;
			const ctx = await app.contextFactory.fromWeb({ language: "ru" });
			const commands = await window.debug.commands();
			await commands.storage.publish.do({ catalogName, ctx, message });
		},
		{ catalogName, message },
	);
};
