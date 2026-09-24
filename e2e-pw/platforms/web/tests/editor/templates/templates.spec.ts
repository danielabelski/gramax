import { sleep } from "@utils/utils";
import { editorTest } from "@web/fixtures/editor.fixture";
import { expect } from "playwright/test";

editorTest.use({
	startUrl: "/template-catalog",
	dir: new URL(".", import.meta.url),
	isolated: true,
});

editorTest.describe("Templates", () => {
	editorTest("create new template", async ({ editor, sharedPage }) => {
		await sharedPage.locator(`[data-sidebar="menu-item"]`).first().hover();
		await sharedPage.getByTestId("article-actions").click();
		await sharedPage.getByTestId("templates-menu").hover();
		await sharedPage.getByTestId("manage-templates").click();
		const templatesPanel = sharedPage.locator("[data-floating-panel-id='templates-library']");
		await expect(templatesPanel).toBeVisible();
		await templatesPanel.getByTestId("create-template").click();
		await templatesPanel.getByRole("button", { name: "Close", exact: true }).click();
		await expect(templatesPanel).toBeHidden();
		await expect(sharedPage.getByTestId("article-editor")).toBeVisible();

		await editorTest.step("fill template", async () => {
			await editor.focus();
			await editor.type("My temporary template");
			await sleep(1000);
			await editor.press("Enter");
			await editor.type("template content");

			await editor.clickToolbar("semiBlocks");
			await sharedPage.getByRole("menuitem", { name: "Variable" }).click();
			await sharedPage.getByRole("menuitem", { name: "Text block" }).click();
		});

		await expect(sharedPage.getByTestId("block-property")).toHaveCount(1);

		await editorTest.step("add new block property", async () => {
			await sleep(1000);
			await editor.clickToolbar("semiBlocks");
			await sharedPage.getByRole("menuitem", { name: "Variable" }).click();
			await sharedPage.getByRole("menuitem", { name: "Add property" }).click();

			await sharedPage.getByPlaceholder("Enter a name").fill("Another text block");
			await sharedPage.getByRole("combobox").filter({ hasText: "Select a type" }).click();
			await sharedPage.getByRole("option", { name: "Block of text" }).click();
			await sharedPage.getByRole("button", { name: "Add", exact: true }).click();
		});

		await expect(sharedPage.getByTestId("modal")).toBeHidden();
		await expect(sharedPage.getByTestId("block-property")).toHaveCount(1);

		await sharedPage.locator(`[data-sidebar="menu-item"]`).first().hover();
		await sharedPage.getByTestId("article-actions").click();
		await sharedPage.getByTestId("templates-menu").hover();
		await sharedPage.getByTestId("manage-templates").click();
		await expect(templatesPanel).toBeVisible();

		// 2 because has this text in templates list and in article
		await expect(sharedPage.getByText("My temporary template")).toHaveCount(2);

		await editor.forceSave();
	});

	editorTest("select and fill template for article", async ({ editor, sharedPage, catalogPage }) => {
		const item = sharedPage.locator(`[data-sidebar="menu-item"]`).first();
		await expect(item).toBeVisible();
		await item.hover();

		await sharedPage.getByTestId("article-actions").click();
		await sharedPage.getByRole("menuitem", { name: "Choose template" }).click();

		await expect(sharedPage.getByRole("menuitem", { name: "My template" })).toBeVisible();

		await sharedPage.getByRole("menuitem", { name: "My template" }).click();
		await catalogPage.waitForLoad();

		await editor.assertMarkdownContains("Text block:");

		await sharedPage.getByTestId("inline-property").first().click();
		await sharedPage.getByRole("menuitemradio", { name: "Yes" }).first().click();
		await editor.press("Escape");
		await expect(sharedPage.getByTestId("inline-property").first()).toContainText("Yes");

		await sharedPage.getByTestId("inline-property").nth(1).click();
		await sharedPage.getByRole("menuitemradio", { name: "First" }).click();
		await editor.press("Escape");
		await expect(sharedPage.getByTestId("inline-property").nth(1)).toContainText("First");

		const blockProperty = await sharedPage.getByTestId("block-property");
		await blockProperty.click();
		await editor.focus();
		await editor.type("its content from text block");

		await editor.assertMarkdownContains("its content from text block");
		await editor.forceSave();

		const props = await catalogPage.currentArticleProps();
		expect(props).toMatchObject({
			properties: expect.arrayContaining([
				expect.objectContaining({ id: "t6hgk" }),
				expect.objectContaining({ id: "W1cZ2", value: ["First"] }),
				expect.objectContaining({ id: "HHkTb", value: ["its content from text block"] }),
			]),
		});

		await sharedPage.reload();
		await catalogPage.waitForLoad();

		await expect(editor.body.getByText("its content from text block", { exact: true })).toHaveCount(1);
	});

	editorTest("delete template", async ({ catalogPage, sharedPage }) => {
		await catalogPage.waitForLoad();
		await sharedPage.locator(`[data-sidebar="menu-item"]`).first().hover();
		await sharedPage.getByTestId("article-actions").click();
		await sharedPage.getByTestId("templates-menu").hover();
		await sharedPage.getByTestId("manage-templates").click();
		const templateRow = sharedPage.getByTestId("template-row").filter({ hasText: "My template" });
		await templateRow.hover();
		await templateRow.getByRole("button", { name: "Template actions" }).click();
		sharedPage.once("dialog", (dialog) => dialog.accept());
		await sharedPage.getByText("Delete").click();

		await expect(templateRow).toBeHidden();
	});
});
