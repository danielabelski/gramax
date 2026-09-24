import { expect } from "@playwright/test";
import { sleep } from "@utils/utils";
import { editorTest } from "@web/fixtures/editor.fixture";

// Serial: the fragment the first test creates is what the next ones insert and then delete, so the
// workspace must survive between them.
editorTest.use({ resetWorkspace: false });

editorTest.describe("Fragments (serial)", () => {
	editorTest.describe.configure({ mode: "serial" });

	editorTest.beforeEach(async () => {
		await sleep(1000);
	});

	editorTest("create & fill fragment", async ({ sharedPage, editor }) => {
		await editorTest.step("create fragment", async () => {
			await editor.clickToolbar("semiBlocks");
			await sharedPage.getByTestId("fragments-menu").hover();
			await sharedPage.getByTestId("manage-fragments").click();
			const fragmentsPanel = sharedPage.locator("[data-floating-panel-id='fragments-library']");
			await expect(fragmentsPanel).toBeVisible();
			await fragmentsPanel.getByTestId("create-fragment").click();
		});

		await editorTest.step("fill fragment", async () => {
			await editor.type("Test Fragment");
			await editor.press("Enter");
			await editor.type("fragment content");
			await editor.press("Enter");
			await editor.clickToolbar("headers");
			await sharedPage.locator('[data-heading-level="2"]').click();
			await editor.type("Fragment Heading");
		});

		await editor.forceSave();
		await sleep(1000);
		await expect(sharedPage.getByText("Test Fragment")).toHaveCount(2);
	});

	editorTest("insert fragment into article", async ({ editor, sharedPage }) => {
		await editor.clickToolbar("semiBlocks");
		await sharedPage.getByTestId("fragments-menu").hover();
		await expect(sharedPage.getByRole("menuitem", { name: "Test Fragment" })).toBeVisible();
		await sharedPage.getByRole("menuitem", { name: "Test Fragment" }).click();
		await editor.assertMarkdownContains(/<fragment id=".+"\/>/);
	});

	editorTest("delete fragment", async ({ editor, sharedPage }) => {
		await editor.clickToolbar("semiBlocks");
		await sharedPage.getByTestId("fragments-menu").hover();
		await sharedPage.getByTestId("manage-fragments").click();
		const fragmentRow = sharedPage.getByTestId("fragment-row").filter({ hasText: "Test Fragment" });
		await fragmentRow.hover();
		await fragmentRow.getByRole("button", { name: "Actions" }).click();
		await sharedPage.getByText("Delete").click();
		await sharedPage.getByRole("button", { name: "Continue" }).click();
	});

	editorTest("verify fragment deleted", async ({ catalogPage, editor, sharedPage }) => {
		await sharedPage.reload();
		await catalogPage.waitForLoad();
		await editor.clickToolbar("semiBlocks");
		await sharedPage.getByTestId("fragments-menu").hover();
		await sharedPage.getByTestId("manage-fragments").click();
		await expect(sharedPage.getByTestId("fragments-empty-state")).toBeVisible();
	});
});
