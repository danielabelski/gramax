import { expect } from "@playwright/test";
import { getSourceDataFromEnv } from "@utils/source";
import { homeTest as test } from "@web/fixtures/home.fixture";
import { ClonePom } from "@web/pom/clone.pom";

const source = getSourceDataFromEnv();

// The storage is seeded by the fixture, so this covers removal only — adding one is part of the
// clone flow (features/git/clone-catalog).
test.use({ source: "env" });

test("a storage removed from the clone form disappears from the list", async ({ homePage, sharedPage }) => {
	// Removing a storage asks for confirmation through the browser's own confirm().
	sharedPage.on("dialog", (dialog) => void dialog.accept());

	const clone = new ClonePom(homePage);
	await clone.open();

	await clone.storageSelect.click();
	await expect(clone.storageOption(source.domain)).toBeVisible();

	await clone.removeStorage(source.domain);

	await expect(clone.storageOption(source.domain)).toHaveCount(0);
});
