import { Dropdown } from "@shared-pom/dropdown";
import { expect } from "playwright/test";
import { viewTest } from "./view.fixture";

viewTest.use({
	startUrl: "/view-test-catalog",
	dir: new URL(".", import.meta.url),
	isolated: false,
});

viewTest.describe("Catalog views", () => {
	viewTest(
		"apply view filtering correctly",
		async ({ catalogPage, sharedPage, openViewsPopover, closeViewsPopover }) => {
			await catalogPage.waitForLoad();

			await openViewsPopover();
			const viewItem = sharedPage.getByTestId("catalog-view-item").nth(0);
			await expect(viewItem).toBeVisible();
			await viewItem.click();

			closeViewsPopover();
			await expect(sharedPage.getByText("Second children category one")).toBeVisible();

			await expect(sharedPage.getByText("123")).toBeVisible();
			await expect(sharedPage.getByText("John Smith")).not.toBeVisible();
		},
	);

	viewTest("apply temporary view filtering correctly", async ({ catalogPage, sharedPage, openViewsPopover }) => {
		await catalogPage.waitForLoad();

		await openViewsPopover();

		const dropdown = new Dropdown(sharedPage, sharedPage.getByTestId("catalog-view-add-property-trigger").nth(0));
		await dropdown.open();

		await dropdown.assertHasItem({ title: "Assignee" });
		await dropdown.findItemByTitle("Assignee").then((item) => item.click());

		const shouldClickTextButtons = ["John Smith", "Elizabeth Swann"];

		const popoverLocator = sharedPage.getByRole("dialog");
		for (const textButton of shouldClickTextButtons) {
			await popoverLocator.getByText(textButton).click();
		}

		const leftNavigationLayout = catalogPage.articleTree;
		await expect(leftNavigationLayout.getByText("First children category one")).not.toBeVisible();
		await expect(leftNavigationLayout.getByText("Firt children category two")).not.toBeVisible();
	});

	viewTest("save temporary view correctly", async ({ catalogPage, sharedPage, openViewsPopover }) => {
		await catalogPage.waitForLoad();

		await openViewsPopover();

		const dropdown = new Dropdown(sharedPage, sharedPage.getByTestId("catalog-view-add-property-trigger").nth(0));
		await dropdown.open();

		await dropdown.assertHasItem({ title: "Assignee" });
		await dropdown.findItemByTitle("Assignee").then((item) => item.click());

		const shouldClickTextButtons = ["John Smith", "Elizabeth Swann"];

		const popoverLocator = sharedPage.getByRole("dialog");
		for (const textButton of shouldClickTextButtons) {
			await popoverLocator.getByText(textButton).click();
		}

		const leftNavigationLayout = catalogPage.articleTree;
		await expect(leftNavigationLayout.getByText("First children category one")).not.toBeVisible();
		await expect(leftNavigationLayout.getByText("Firt children category two")).not.toBeVisible();

		await popoverLocator.getByRole("button", { name: "Save" }).click();

		const input = popoverLocator.getByTestId("catalog-view-item-input");
		await expect(input).toBeVisible();
		await input.fill("Test view");

		await popoverLocator.getByRole("button", { name: "Save" }).click();

		await expect(sharedPage.getByText("Test view")).toBeVisible();
	});

	viewTest("edit saved view correctly", async ({ catalogPage, sharedPage, openViewsPopover }) => {
		await catalogPage.waitForLoad();

		await openViewsPopover();
		const viewItem = sharedPage.getByTestId("catalog-view-item").nth(0);
		const dropdown = new Dropdown(sharedPage, viewItem.getByTestId("catalog-view-item-menu-trigger"));
		await dropdown.open();

		await dropdown.assertHasItem({ title: "Edit" });
		await dropdown.findItemByTitle("Edit").then((item) => item.click());

		const input = sharedPage.getByTestId("catalog-view-item-input");
		await expect(input).toBeVisible();
		await input.fill("Test view 2");

		// Scoped to the popover, like the sibling test: an unscoped "Save" can land on a button that
		// belongs to something else on the page.
		await sharedPage.getByRole("dialog").getByRole("button", { name: "Save" }).click();

		// By name, not by position — the list reorders once the view is renamed, so the row that was
		// first is not necessarily the one that was edited.
		await expect(sharedPage.getByTestId("catalog-view-item").filter({ hasText: "Test view 2" })).toBeVisible();
	});

	viewTest("delete temporary view correctly", async ({ basePage, catalogPage, sharedPage, openViewsPopover }) => {
		await catalogPage.waitForLoad();

		await openViewsPopover();
		const viewItem = sharedPage.getByTestId("catalog-view-item").nth(0);
		// Remember which one is being deleted: counting leftover placeholders depends on how many
		// views the preceding tests happened to leave behind.
		const deletedName = ((await viewItem.textContent()) ?? "").trim();
		expect(deletedName).not.toBe("");

		const dropdown = new Dropdown(sharedPage, viewItem.getByTestId("catalog-view-item-menu-trigger"));
		await dropdown.open();

		await dropdown.assertHasItem({ title: "Delete" });
		await dropdown.findItemByTitle("Delete").then((item) => item.click());

		await expect(basePage.modal).toBeVisible();

		await basePage.modal.getByRole("button", { name: "Continue" }).click();

		await openViewsPopover();

		await expect(
			sharedPage.getByTestId("catalog-view-item").filter({
				has: sharedPage.getByText(deletedName, { exact: true }),
			}),
		).toHaveCount(0);
	});
});
