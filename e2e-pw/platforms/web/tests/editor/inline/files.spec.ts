import { md } from "@utils/utils";
import { editorTest } from "@web/fixtures/editor.fixture";

editorTest.describe("Attach files", () => {
	editorTest("several files at once are inserted separated by a space", async ({ editor, sharedPage }) => {
		await editor.setMarkdown("(*)");
		await editor.clickToolbar("semiBlocks");

		await sharedPage.locator('label:has([data-qa="qa-edit-menu-file"]) input[type="file"]').setInputFiles([
			{ name: "first.txt", mimeType: "text/plain", buffer: Buffer.from("first") },
			{ name: "second.txt", mimeType: "text/plain", buffer: Buffer.from("second") },
		]);

		await editor.assertMarkdown(md`
			[first.txt](./first.txt) [second.txt](./second.txt)
		`);
	});
});
