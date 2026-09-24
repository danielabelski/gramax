import { expect, test } from "@playwright/test";
import { env } from "@utils/utils";

for (const { width, pinned, visible } of [
	{ width: 1710, pinned: true, visible: true },
	{ width: 1710, pinned: false, visible: false },
	{ width: 390, pinned: true, visible: false },
]) {
	test(`sidebar before hydration: viewport ${width}, pinned ${pinned}`, async ({ page }) => {
		await page.setViewportSize({ width, height: 1073 });
		await page.addInitScript((isLeftPinned) => {
			localStorage.setItem("SidebarsIsPin", JSON.stringify({ state: { isLeftPinned }, version: 1 }));
		}, pinned);
		await page.route("**/*", (route) =>
			route.request().resourceType() === "script" ? route.abort() : route.continue(),
		);
		await page.goto(`/${env("GX_E2E_GIT_TEST_REPO")}`);

		const navigation = page.getByRole("navigation", { name: "Catalog navigation", includeHidden: true });
		await expect(navigation).toHaveCount(1);
		if (visible) await expect(navigation).toBeInViewport();
		else await expect(navigation).not.toBeInViewport();

		const mobileToggle = page.getByRole("button", { name: /боковую панель|sidebar/i });
		if (width < 1024) await expect(mobileToggle).toBeVisible();
		else await expect(mobileToggle).toBeHidden();
	});
}
