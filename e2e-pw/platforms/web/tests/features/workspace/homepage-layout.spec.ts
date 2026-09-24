import { expect, type Locator, type Page } from "@playwright/test";
import { evaluateOnApp } from "@utils/app";
import { homeTest } from "@web/fixtures/home.fixture";

const catalog = (title: string) => ({
	".doc-root.yaml": `title: ${title}\ndescription: ${title} documentation\n`,
	"_index.md": `---\ntitle: ${title}\n---\n`,
});

homeTest.use({
	isolated: true,
	files: {
		"workspace.yaml": `name: Legacy layout\nsections:\n  docs:\n    title: Documentation\n    view: section\n    catalogs:\n      - beta\n      - alpha\n`,
		alpha: catalog("Alpha"),
		beta: catalog("Beta"),
	},
});

const visibleCatalogTitles = (page: Page): Locator => page.getByText(/^(Alpha|Beta)$/);

const dragBefore = async (page: Page, source: Locator, target: Locator) => {
	const sourceBox = await source.boundingBox();
	const targetBox = await target.boundingBox();
	expect(sourceBox).not.toBeNull();
	expect(targetBox).not.toBeNull();
	if (!sourceBox || !targetBox) return;

	await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
	await page.mouse.down();
	await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2 + 12, { steps: 4 });
	// Card centers create a folder. The lower-right corner is the reorder zone.
	await page.mouse.move(targetBox.x + targetBox.width * 0.9, targetBox.y + targetBox.height * 0.9, { steps: 12 });
	await page.mouse.up();
};

homeTest(
	"reads a legacy layout and writes only the canonical layout after drag-and-drop",
	async ({ homePage, sharedPage }) => {
		await homeTest.step("legacy sections define the visible section and catalog order", async () => {
			await expect(sharedPage.getByText("Documentation", { exact: true })).toBeVisible();
			await expect(visibleCatalogTitles(sharedPage)).toHaveText(["Beta", "Alpha"]);
		});

		await homeTest.step("catalog order can be changed in the personal view", async () => {
			await sharedPage.getByRole("button", { name: "Account" }).click();
			await sharedPage.getByText("Configure home view", { exact: true }).click();
			await expect(sharedPage.getByText("Editing personal view", { exact: true })).toBeVisible();

			await dragBefore(
				sharedPage,
				sharedPage.getByRole("button", { name: "Alpha Alpha documentation", exact: true }).first(),
				sharedPage.getByRole("button", { name: "Beta Beta documentation", exact: true }).first(),
			);
			await expect(visibleCatalogTitles(sharedPage)).toHaveText(["Alpha", "Beta"]);
			await sharedPage.getByRole("button", { name: "Save", exact: true }).click();
			await expect(sharedPage.getByText("Editing personal view", { exact: true })).toBeHidden();
		});

		await homeTest.step("save migrates workspace.yaml and survives reload", async () => {
			const saved = await evaluateOnApp(
				sharedPage,
				async () => {
					const { wm } = await window.app!;
					const config = await wm.current().config();
					const yaml = await wm.current().getFileProvider().read(window.debug.intoPath("workspace.yaml"));
					return { config, yaml };
				},
				undefined,
			);

			expect(saved.config.layout).toEqual({
				items: [
					{
						type: "section",
						id: "docs",
						title: "Documentation",
						view: "section",
						items: [
							{ type: "catalog", name: "alpha" },
							{ type: "catalog", name: "beta" },
						],
					},
				],
			});
			expect(saved.config).not.toHaveProperty("sections");
			expect(saved.config).not.toHaveProperty("personalSections");
			expect(saved.yaml).toContain("layout:");
			expect(saved.yaml).not.toMatch(/^sections:/m);
			expect(saved.yaml).not.toMatch(/^personalSections:/m);

			await sharedPage.reload();
			await homePage.waitForLoad();
			await expect(visibleCatalogTitles(sharedPage)).toHaveText(["Alpha", "Beta"]);
		});
	},
);
