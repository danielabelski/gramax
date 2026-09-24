import type { Page } from "@playwright/test";
import { getSourceDataFromEnv, getTestRepoInfoFromEnv } from "@utils/source";
import { linkCatalogToRepo } from "@web/fixtures/git.fixture";
import type CatalogPage from "@web/pom/catalog.page";
import { type FileTree, setStorage } from "@web/utils";

const repo = getTestRepoInfoFromEnv();

/** The seed article every git spec starts from. */
export const ARTICLE = "test";
export const ARTICLE_TITLE = "Test";
export const ARTICLE_TEXT = "A";

/** A minimal catalog whose directory name is the repository name it will be pushed to. */
export const catalogFiles = (name: string, extra: FileTree = {}): FileTree => ({
	[name]: {
		".doc-root.yaml": `title: ${name}\nsyntax: xml\n`,
		[`${ARTICLE}.md`]: `---\ntitle: ${ARTICLE_TITLE}\n---\n\n${ARTICLE_TEXT}\n`,
		...extra,
	},
});

/** `/-/-/-/-/<catalog>/<article>` — the address of a catalog with no repository behind it. */
export const localCatalogUrl = (name: string, article: string = ARTICLE): string => `/-/-/-/-/${name}/${article}`;

/** `/<host>/<group>/<repo>/<branch>/-/<article>` — the address a catalog gets once it is linked. */
export const remoteCatalogUrl = (name: string, article: string = ARTICLE, branch = "master"): string =>
	`/${repo.host}/${encodeURIComponent(repo.tempGroup)}/${name}/${branch}/-/${article}`;

/**
 * Writes a local catalog, points it at `<temp group>/<name>` and lands on its first article.
 *
 * Linking runs `storage/init`, which commits the whole tree and pushes it, so the GitLab project is
 * created by this call (push-to-create) — no separate publish is needed for the seed state.
 */
export const prepareLinkedCatalog = async (
	catalogPage: CatalogPage,
	page: Page,
	{ name, files }: { name: string; files?: FileTree },
): Promise<void> => {
	await catalogPage.createFileTree(page, files ?? catalogFiles(name));
	await setStorage(page, getSourceDataFromEnv());

	// A full navigation, so the workspace rescans the file system and picks the new catalog up.
	await catalogPage.goto(localCatalogUrl(name));
	await catalogPage.waitForLoad();

	await linkCatalogToRepo(page, { catalogName: name, repoName: name });

	await catalogPage.goto(remoteCatalogUrl(name));
	await catalogPage.waitForLoad();
};
