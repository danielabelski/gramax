import { expect } from "@playwright/test";
import { baseTest as test } from "@web/fixtures/base.fixture";

test.use({
	startUrl: "/navigation-animation/section/first",
	files: {
		"navigation-animation": {
			"doc-root.yml": "title: Navigation animation\n",
			section: {
				"_index.md": "---\ntitle: Section\norder: 0\n---\n",
				"first.md": "---\ntitle: First\norder: 0\n---\nFirst article.",
				"second.md": "---\ntitle: Second\norder: 1\n---\nSecond article.",
				"third.md": "---\ntitle: Third\norder: 2\n---\nThird article.",
			},
			"following.md": "---\ntitle: Following\norder: 1\n---\nFollowing article.",
		},
	},
});

for (const readOnly of [false, true]) {
	test(`${readOnly ? "Readonly" : "Editable"} branches slide in both directions`, async ({ sharedPage: page }) => {
		await page.evaluate((value) => localStorage.setItem("READ_ONLY", value ? "1" : ""), readOnly);
		await page.clock.install({ time: await page.evaluate(() => Date.now()) });
		await page.reload();
		const navigation = page.getByRole("navigation", { name: "Catalog navigation" });
		const first = navigation.getByText("First", { exact: true });
		const following = navigation.getByText("Following", { exact: true });
		await expect(first).toBeInViewport();
		await expect(following).toBeInViewport();
		await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
		const followingTop = async () => (await following.boundingBox())!.y;
		const expandedTop = await followingTop();
		await navigation.getByRole("button", { name: "Collapse", exact: true }).click();
		await expect(first).toHaveCount(1);
		expect(await followingTop()).toBeCloseTo(expandedTop);
		await page.clock.runFor(64);
		const closingTop = await followingTop();
		expect(closingTop).toBeLessThan(expandedTop);
		await expect(first).toHaveCount(1);
		await page.clock.runFor(160);
		const collapsedTop = await followingTop();
		expect(closingTop).toBeGreaterThan(collapsedTop);
		await expect(first).toHaveCount(0);

		await navigation.getByRole("button", { name: "Expand", exact: true }).click();
		expect(await followingTop()).toBeCloseTo(collapsedTop);
		await page.clock.runFor(64);
		const openingTop = await followingTop();
		expect(openingTop).toBeGreaterThan(collapsedTop);
		expect(openingTop).toBeLessThan(expandedTop);
		await expect(first).toBeInViewport();
		await expect(first).toHaveCSS("opacity", "1");
		await page.clock.runFor(160);
		expect(await followingTop()).toBeCloseTo(expandedTop);
		await page.clock.resume();
	});
}

test("the add-article line remains easy to hit between virtual rows", async ({ sharedPage: page }) => {
	await page.evaluate(() => localStorage.removeItem("READ_ONLY"));
	await page.reload();
	const navigation = page.getByRole("navigation", { name: "Catalog navigation" });
	const first = navigation.getByRole("button", { name: "First", exact: true });
	const second = navigation.getByRole("button", { name: "Second", exact: true });
	await expect(first).toBeInViewport();
	await expect(second).toBeInViewport();
	const firstBox = (await first.boundingBox())!;
	const secondBox = (await second.boundingBox())!;

	await page.mouse.move(firstBox.x + 8, secondBox.y + 1);
	await page.waitForTimeout(250);
	await page.mouse.click(firstBox.x + 8, secondBox.y + 1);

	await expect.poll(() => new URL(page.url()).pathname).toContain("/navigation-animation/section/untitled");
});
