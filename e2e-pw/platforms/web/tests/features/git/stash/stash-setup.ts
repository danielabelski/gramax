import type { Page } from "@playwright/test";
import { type GitlabProject, getProject } from "@utils/gitlab";
import { getTestRepoInfoFromEnv } from "@utils/source";
import type CatalogPage from "@web/pom/catalog.page";
import type { FileTree } from "@web/utils";
import { catalogFiles, prepareLinkedCatalog } from "../catalog-setup";

/** `.gitignore` lives in the catalog root and is pushed with it, so the rule holds on both sides. */
export const IGNORE_RULE = "*.tmp";
export const IGNORED_FILE = "local-notes.tmp";
export const IGNORED_CONTENT = "Notes that git was told to leave alone.\n";

/** A second article, so an incoming change can land somewhere the local edit is not. */
export const OTHER_ARTICLE = "other";
export const OTHER_ARTICLE_TITLE = "Other";

/** A binary resource, for the cases that must show a stash carries bytes intact. */
export const RESOURCE_FILE = "image.png";
/** A 1x1 PNG. Small enough to compare byte for byte in an assertion message. */
export const RESOURCE_BYTES = [
	137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196,
	137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 250, 207, 0, 0, 2, 7, 1, 2, 154, 28, 49, 113, 0, 0, 0, 0, 73, 69,
	78, 68, 174, 66, 96, 130,
];

/** Articles a case can dirty in bulk, named `bulk-1.md`…`bulk-N.md`. */
export const bulkArticle = (n: number): string => `bulk-${n}`;

const bulkFiles = (count: number): FileTree =>
	Object.fromEntries(
		Array.from({ length: count }, (_, i) => [
			`${bulkArticle(i + 1)}.md`,
			`---\ntitle: Bulk ${i + 1}\n---\n\nSeeded bulk article ${i + 1}.\n`,
		]),
	);

const extraFiles = (bulk: number): FileTree => ({
	".gitignore": `${IGNORE_RULE}\n`,
	[RESOURCE_FILE]: RESOURCE_BYTES,
	[`${OTHER_ARTICLE}.md`]: `---\ntitle: ${OTHER_ARTICLE_TITLE}\n---\n\nSeeded second article.\n`,
	...bulkFiles(bulk),
});

/**
 * Links a catalog and hands back the GitLab project behind it.
 *
 * The stash cases need both ends: the app drives the working copy, and the test commits to the
 * remote directly to create something to pull. Linking is push-to-create, so the project only
 * exists — and only has an id — once `prepareLinkedCatalog` has run.
 */
export const prepareStashCatalog = async (
	catalogPage: CatalogPage,
	page: Page,
	{ name, bulk = 0 }: { name: string; bulk?: number },
): Promise<GitlabProject> => {
	await prepareLinkedCatalog(catalogPage, page, { name, files: catalogFiles(name, extraFiles(bulk)) });

	const { tempGroup } = getTestRepoInfoFromEnv();
	return await getProject(`${tempGroup}/${name}`);
};
