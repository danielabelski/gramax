import { expect } from "@playwright/test";
import { commitToRemote, type GitlabProject, getProject, readRemoteFile } from "@utils/gitlab";
import { getTestRepoInfoFromEnv } from "@utils/source";
import { gitTest as test } from "@web/fixtures/git.fixture";
import { ArticleEditorPom } from "@web/pom/editor.pom";
import { ARTICLE, ARTICLE_TEXT, ARTICLE_TITLE, prepareLinkedCatalog, remoteCatalogUrl } from "./catalog-setup";

// The remote branch is ahead by a commit that changes no file ("Update file: …" saved without an edit).
// Counted in files, such a commit is zero to pull, so sync used to skip it and every publish after that
// was refused as stale — a loop the interface could not break.

test.use({ isolated: false });
test.describe.configure({ mode: "serial" });

const EDITED_TEXT = "Edited while the remote is ahead by an empty commit";

let catalogName: string;
let project: GitlabProject;

test.describe("sync of an empty remote commit", () => {
	test("links a fresh catalog to its repository", async ({ catalogPage, sharedPage, tempRepoName }) => {
		catalogName = tempRepoName;
		await prepareLinkedCatalog(catalogPage, sharedPage, { name: catalogName });
		project = await getProject(`${getTestRepoInfoFromEnv().tempGroup}/${catalogName}`);

		await catalogPage.git().assertCurrentBranch("master");
	});

	test("publishes an edit after a sync that took the empty commit", async ({ catalogPage }) => {
		// An update that writes the content the file already has: the commit carries no file change.
		await commitToRemote(
			project.id,
			[
				{
					action: "update",
					content: `---\ntitle: ${ARTICLE_TITLE}\n---\n\n${ARTICLE_TEXT}\n`,
					filePath: `${ARTICLE}.md`,
				},
			],
			`Update file: ${ARTICLE}.md`,
		);

		await catalogPage.goto(remoteCatalogUrl(catalogName));
		await catalogPage.waitForLoad();

		const editor = new ArticleEditorPom(catalogPage);
		await editor.rewrite(EDITED_TEXT);
		await editor.assertMarkdownContains(EDITED_TEXT);

		const git = catalogPage.git();
		await git.sync();
		await catalogPage.waitForLoad();

		await git.publish("e2e: publish after the empty commit");
		await git.assertNothingToPublish();

		expect(await readRemoteFile(project.id, `${ARTICLE}.md`)).toContain(EDITED_TEXT);
	});
});
