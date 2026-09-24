import { expect, type Locator } from "@playwright/test";
import { catalogTest } from "@web/fixtures/catalog.fixture";
import type CatalogPage from "@web/pom/catalog.page";

// Aliases belong to the main-language article and the redirect is mirrored into every language
// URL space, so the same alias must work in /ml/<alias> and /ml/en/<alias> whichever language
// version it was typed in.
catalogTest.use({
	files: {
		ml: {
			"doc-root.yml": "title: ML\nlanguage: ru\nsupportedLanguages:\n  - ru\n  - en\n",
			"setup.md": `---
title: Установка
---

ru body
`,
			"guide.md": `---
title: Руководство
aliases:
  - legacy/guide
---

ru guide body
`,
			"dup.md": `---
title: Дубль
aliases:
  - dup/legacy
---

ru dup body
`,
			en: {
				"_index.md": "",
				"setup.md": `---
title: Setup
---

en body
`,
				"guide.md": `---
title: Guide
---

en guide body
`,
				// a translation that kept its own copy of the paths, as older versions wrote them
				"dup.md": `---
title: Dup
aliases:
  - dup/legacy
---

en dup body
`,
			},
		},
	},
	startUrl: "/-/-/-/-/ml/setup",
});

const openArticleSettings = async (catalogPage: CatalogPage, title: string) => {
	const page = catalogPage.raw;
	const navItem = page.locator('[data-qa^="catalog-navigation-article-link-level-"]', { hasText: title }).first();
	await navItem.hover();
	await navItem.getByTestId("article-actions").first().click();
	await page.getByRole("menuitem", { name: "Configure" }).click();
	const dialog = catalogPage.modal;
	await expect(dialog.getByText("Article settings")).toBeVisible();
	return dialog;
};

const addAlias = async (dialog: Locator, alias: string) => {
	const input = dialog.getByPlaceholder("e.g. guide/install");
	await input.fill(alias);
	await input.press("Enter");
	await expect(dialog.getByText(alias, { exact: true })).toBeVisible();
};

// a catalog with several languages warns that the change touches every language version
const saveSettings = async (catalogPage: CatalogPage, dialog: Locator) => {
	await dialog.getByRole("button", { name: "Save" }).click();
	await catalogPage.raw.getByRole("button", { name: "Continue" }).click();
	await catalogPage.waitForLoad();
	await expect(catalogPage.modal.getByText("Article settings")).toBeHidden();
};

const assertOpens = async (catalogPage: CatalogPage, path: string, body: string) => {
	await catalogPage.goto(path);
	await catalogPage.waitForLoad();
	await expect(catalogPage.raw.getByText(body)).toBeVisible();
};

const assertAliasWorksInBothLanguages = async (catalogPage: CatalogPage, alias: string) => {
	await assertOpens(catalogPage, `/-/-/-/-/ml/${alias}`, "ru body");
	await assertOpens(catalogPage, `/-/-/-/-/ml/en/${alias}`, "en body");
};

catalogTest.describe("Aliases in a multilingual catalog", () => {
	catalogTest("alias added on the main-language article resolves in both languages", async ({ catalogPage }) => {
		const dialog = await openArticleSettings(catalogPage, "Установка");
		await addAlias(dialog, "install");
		await saveSettings(catalogPage, dialog);

		await assertAliasWorksInBothLanguages(catalogPage, "install");
	});

	catalogTest(
		"multi-segment alias on the main-language article resolves in both languages",
		async ({ catalogPage }) => {
			const dialog = await openArticleSettings(catalogPage, "Установка");
			await addAlias(dialog, "docs/legacy/install");
			await saveSettings(catalogPage, dialog);

			await assertAliasWorksInBothLanguages(catalogPage, "docs/legacy/install");
		},
	);

	catalogTest("alias added on the translation resolves in both languages", async ({ catalogPage }) => {
		await catalogPage.goto("/-/-/-/-/ml/en/setup");
		await catalogPage.waitForLoad();

		const dialog = await openArticleSettings(catalogPage, "Setup");
		await addAlias(dialog, "install");
		await saveSettings(catalogPage, dialog);

		await assertAliasWorksInBothLanguages(catalogPage, "install");

		await catalogTest.step("the main-language article owns the alias", async () => {
			await catalogPage.goto("/-/-/-/-/ml/setup");
			await catalogPage.waitForLoad();
			const ruDialog = await openArticleSettings(catalogPage, "Установка");
			await expect(ruDialog.getByText("install", { exact: true })).toBeVisible();
		});
	});

	catalogTest("multi-segment alias added on the translation resolves in both languages", async ({ catalogPage }) => {
		await catalogPage.goto("/-/-/-/-/ml/en/setup");
		await catalogPage.waitForLoad();

		const dialog = await openArticleSettings(catalogPage, "Setup");
		await addAlias(dialog, "docs/legacy/install");
		await saveSettings(catalogPage, dialog);

		await assertAliasWorksInBothLanguages(catalogPage, "docs/legacy/install");
	});

	// the paths a translation shows belong to its main-language article; counting them as taken
	// made the dialog reject the submit without showing why, so saving did nothing at all
	catalogTest("URL of a translation is saved while it shows inherited paths", async ({ catalogPage }) => {
		await catalogPage.goto("/-/-/-/-/ml/en/guide");
		await catalogPage.waitForLoad();

		const dialog = await openArticleSettings(catalogPage, "Guide");
		await expect(dialog.getByText("legacy/guide", { exact: true })).toBeVisible();

		await dialog.locator('[data-qa="URL"]').fill("guide-2");
		await saveSettings(catalogPage, dialog);

		await assertOpens(catalogPage, "/-/-/-/-/ml/en/guide-2", "en guide body");
		await assertOpens(catalogPage, "/-/-/-/-/ml/legacy/guide", "ru guide body");
	});

	// the same path stored in both language files made every one of them look taken by the
	// other language version, and the save silently did nothing
	catalogTest("URL is saved when both language versions carry the same paths", async ({ catalogPage }) => {
		const dialog = await openArticleSettings(catalogPage, "Дубль");
		await expect(dialog.getByText("dup/legacy", { exact: true })).toBeVisible();

		await dialog.locator('[data-qa="URL"]').fill("dup-2");
		await saveSettings(catalogPage, dialog);

		await assertOpens(catalogPage, "/-/-/-/-/ml/dup-2", "ru dup body");
	});
});
