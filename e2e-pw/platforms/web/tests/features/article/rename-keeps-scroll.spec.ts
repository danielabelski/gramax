import { expect, type Page } from "@playwright/test";
import { catalogTest } from "@web/fixtures/catalog.fixture";

// Scroll positions are keyed by file path — an address, not a name. A rename changes the address and
// leaves the same article on screen: without moving the entry the scrolled article jumps to the top,
// and the abandoned position goes to the next article taking that path — a new article's placeholder
// is always `untitled.md`, and the path is freed right here.

const LONG_BODY = Array.from({ length: 120 }, (_, i) => `paragraph number ${i}`).join("\n\n");

catalogTest.use({
	startUrl: "/scroll-rename/untitled",
	files: {
		"scroll-rename": {
			"doc-root.yml": "title: Scroll Rename\n",
			"untitled.md": LONG_BODY,
		},
	},
});

const RENAME_RESPONSE_DELAY = 3000;

const scrollTop = (page: Page) =>
	page.evaluate(() => document.querySelector('[data-testid="article-scroll-container"]')?.scrollTop ?? -1);

catalogTest("a renamed article stays where it was scrolled to", async ({ basePage, sharedPage }) => {
	await basePage.waitForLoad();

	// The rename response is delayed so the scroll happens before the address moves, not after:
	// otherwise the spec would be checking event order rather than the move itself.
	await sharedPage.evaluate((delay) => {
		const w = window as unknown as {
			commands: Record<string, Record<string, { do: (params: unknown) => Promise<unknown> }>>;
		};
		const cmd = w.commands.item!.updateProps!;
		const original = cmd.do.bind(cmd);
		cmd.do = async (params: unknown) => {
			const result = await original(params);
			await new Promise((resolve) => setTimeout(resolve, delay));
			return result;
		};
	}, RENAME_RESPONSE_DELAY);

	// The title is the article's first node; an editor with content does not take the caret by itself.
	await sharedPage
		.getByRole("textbox", { name: "Main content area, start typing to enter text." })
		.locator("> *")
		.first()
		.click();
	await sharedPage.keyboard.type("Scrolled Title", { delay: 60 });
	// Leaving the title is the rename.
	await sharedPage.keyboard.press("ArrowDown");

	console.log(
		"DEBUG html:",
		await sharedPage.evaluate(() => {
			const ed = document.querySelector('[data-testid="article-editor"]');
			return Array.from(ed?.children ?? [])
				.slice(0, 3)
				.map((c) => c.outerHTML.slice(0, 200))
				.join("\n---\n");
		}),
	);
	console.log(
		"DEBUG text:",
		(await sharedPage.getByTestId("article-editor").innerText()).slice(0, 80).replace(/\n/g, " | "),
	);
	const container = sharedPage.locator('[data-testid="article-scroll-container"]');
	await container.evaluate((el) => {
		el.scrollTop = 900;
	});
	await expect(async () => {
		expect(await scrollTop(sharedPage)).toBeGreaterThan(500);
	}).toPass({ timeout: 5_000 });

	await sharedPage.waitForURL(/scrolled-title/, { timeout: 25_000 });
	await basePage.waitForLoad();

	// Moving the address does not touch where the reader is looking.
	await expect(async () => {
		expect(await scrollTop(sharedPage)).toBeGreaterThan(500);
	}).toPass({ timeout: 10_000 });
});
