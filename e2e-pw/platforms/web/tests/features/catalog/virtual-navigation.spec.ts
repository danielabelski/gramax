import { expect } from "@playwright/test";
import { baseTest as test } from "@web/fixtures/base.fixture";

const articles = Object.fromEntries(
	Array.from({ length: 1000 }, (_, index) => {
		const number = String(index).padStart(4, "0");
		return [`row-${number}.md`, `---\ntitle: Row ${number}\norder: ${index}\n---\n\nArticle ${number}.`];
	}),
);

test.use({
	startUrl: "/virtual-navigation/section/row-0000",
	files: {
		"virtual-navigation": {
			"doc-root.yml": "title: Virtual navigation\n",
			section: { "_index.md": "---\ntitle: Section\n---\n", ...articles },
		},
	},
});

for (const isReadOnly of [false, true]) {
	test(`${isReadOnly ? "Readonly" : "Editable"} navigation windows expanded rows and reveals a distant article`, async ({
		sharedPage,
	}) => {
		await sharedPage.evaluate((readOnly) => localStorage.setItem("READ_ONLY", readOnly ? "1" : ""), isReadOnly);
		await sharedPage.reload();
		const navigation = sharedPage.getByRole("navigation", { name: "Catalog navigation" });
		await expect(navigation.getByText("Row 0000", { exact: true })).toBeInViewport();
		await expect.poll(() => navigation.getByRole("listitem").count()).toBeLessThan(80);
		await expect(navigation.getByText("Row 0999", { exact: true })).toHaveCount(0);

		await navigation.hover();
		await sharedPage.mouse.wheel(0, 40000);
		await expect(navigation.getByText("Row 0999", { exact: true })).toBeInViewport();
		await expect(navigation.getByText("Row 0000", { exact: true })).toHaveCount(0);
		await expect.poll(() => navigation.getByRole("listitem").count()).toBeLessThan(80);

		await sharedPage.goto("/-/-/-/-/virtual-navigation/section/row-0500");
		await expect(navigation.getByText("Row 0500", { exact: true })).toBeInViewport();
		await navigation.hover();
		await sharedPage.mouse.wheel(0, -40000);
		await expect(navigation.getByText("Row 0000", { exact: true })).toBeInViewport();
		await expect(navigation.getByText("Row 0500", { exact: true })).toHaveCount(0);

		const sizes = () =>
			navigation.evaluate((element) => {
				let parent = element.parentElement;
				while (parent && !["auto", "scroll"].includes(getComputedStyle(parent).overflowY))
					parent = parent.parentElement;
				if (!parent) throw new Error("Navigation scroll container is missing");
				return {
					height: element.getBoundingClientRect().height,
					scrollHeight: parent.scrollHeight,
					viewport: parent.clientHeight,
				};
			});
		const before = await sizes();
		const outsideHeight = before.scrollHeight - before.height;
		await sharedPage.clock.install({ time: await sharedPage.evaluate(() => Date.now()) });
		await sharedPage.clock.pauseAt((await sharedPage.evaluate(() => Date.now())) + 1000);
		await navigation.getByRole("button", { name: "Collapse", exact: true }).click();
		for (let frame = 0; frame < 16; frame++) {
			await sharedPage.clock.runFor(16);
			const current = await sizes();
			expect(current.scrollHeight).toBeLessThanOrEqual(
				Math.max(current.viewport, current.height + outsideHeight) + 2,
			);
			expect(await navigation.getByRole("listitem").count()).toBeLessThan(80);
		}
		await sharedPage.clock.resume();
		await expect(navigation.getByText("Row 0000", { exact: true })).toHaveCount(0);
		await navigation.getByRole("button", { name: "Expand", exact: true }).click();
		await expect(navigation.getByText("Row 0000", { exact: true })).toBeInViewport();
		await expect.poll(() => navigation.getByRole("listitem").count()).toBeLessThan(80);
	});
}

test("keeps the drag source mounted while scrolling to a distant drop target", async ({ sharedPage }) => {
	await sharedPage.evaluate(() => localStorage.removeItem("READ_ONLY"));
	await sharedPage.reload();
	const navigation = sharedPage.getByRole("navigation", { name: "Catalog navigation" });
	const source = navigation.getByText("Row 0001", { exact: true });
	await expect(source).toBeInViewport();
	const sourceBox = (await source.boundingBox())!;
	await sharedPage.mouse.move(sourceBox.x + 10, sourceBox.y + sourceBox.height / 2);
	await sharedPage.mouse.down();
	await sharedPage.mouse.move(sourceBox.x + 20, sourceBox.y + sourceBox.height / 2, { steps: 5 });
	await sharedPage.mouse.move(sourceBox.x + 20, sharedPage.viewportSize()!.height - 8, { steps: 10 });

	const target = navigation.getByText("Row 0999", { exact: true });
	await expect(target).toBeInViewport({ timeout: 45000 });
	await expect
		.poll(
			() =>
				navigation.evaluate((element) => {
					let parent = element.parentElement;
					while (parent) {
						if (["auto", "scroll"].includes(getComputedStyle(parent).overflowY)) {
							return parent.scrollHeight - parent.clientHeight - parent.scrollTop;
						}
						parent = parent.parentElement;
					}
					return Infinity;
				}),
			{ timeout: 45000 },
		)
		.toBeLessThan(1);
	await expect(source).toHaveCount(1);
	await expect.poll(() => navigation.getByRole("listitem").count()).toBeLessThan(80);
	const targetBox = (await navigation.getByRole("button", { name: "Row 0999", exact: true }).boundingBox())!;
	await sharedPage.mouse.move(targetBox.x + 10, targetBox.y + targetBox.height - 2, { steps: 10 });
	await sharedPage.mouse.up();
	await expect
		.poll(async () => (await navigation.getByText(/^Row \d{4}$/).allTextContents()).slice(-2))
		.toEqual(["Row 0999", "Row 0001"]);
});
