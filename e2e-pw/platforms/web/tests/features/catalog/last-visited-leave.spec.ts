import { expect, type Page } from "@playwright/test";
import { articleActionsButton, navItem } from "@utils/catalogTree";
import { catalogTest } from "@web/fixtures/catalog.fixture";

// The catalog card leads to the article its reader was last shown. A page is often read again on the
// way out of it — closing a template does that — and such a read races the read of the next page: it
// must not take the card back, and leaving through the navigation alone must not cause one. The race is
// won or lost by milliseconds, so reads of the page being left are slowed down here: they start on time
// and land last, on every run, not only when the page is heavy.

type Reads = { started: number; landed: number };

const slowDownReadsOf = (page: Page, pathEnd: string) =>
	page.evaluate((pathEnd) => {
		type Read = (props: { path: string }) => Promise<unknown>;
		const w = window as unknown as { commands: { page: { getPageData: { do: Read } } }; slowReads: Reads };
		const command = w.commands.page.getPageData;
		const read = command.do.bind(command) as Read;
		const reads: Reads = { started: 0, landed: 0 };
		w.slowReads = reads;
		command.do = async (props) => {
			if (!props.path?.endsWith(pathEnd)) return read(props);
			reads.started++;
			await new Promise((resolve) => setTimeout(resolve, 300));
			try {
				return await read(props);
			} finally {
				reads.landed++;
			}
		};
	}, pathEnd);

const slowReads = (page: Page) => page.evaluate(() => ({ ...(window as unknown as { slowReads: Reads }).slowReads }));

const slowReadsLanded = (page: Page) =>
	expect.poll(async () => ((reads) => reads.started - reads.landed)(await slowReads(page))).toBe(0);

catalogTest.use({
	startUrl: "/card-leave/first",
	files: {
		"card-leave": {
			"doc-root.yml": "title: Card Leave\n",
			"first.md": "---\ntitle: First\norder: 1\n---\n\nfirst body",
			"second.md": "---\ntitle: Second\norder: 2\n---\n\nsecond body",
			".gramax": { templates: { "leave.md": "---\ntitle: Leave Template\n---\n\ntemplate body" } },
		},
	},
});

catalogTest.describe("Catalog card after leaving an article", () => {
	catalogTest(
		"leaving an article through the navigation puts the card on the next one",
		async ({ basePage, sharedPage }) => {
			await expect(sharedPage.getByText("first body")).toBeVisible();
			await slowDownReadsOf(sharedPage, "/card-leave/first");

			await navItem(sharedPage, "Second").click();
			await expect(sharedPage.getByText("second body")).toBeVisible();
			await slowReadsLanded(sharedPage);
			expect((await slowReads(sharedPage)).started, "the page being left is not read again").toBe(0);

			await basePage.navigate("/");
			await expect(sharedPage.getByRole("link", { name: "Card Leave" })).toHaveAttribute(
				"href",
				/\/card-leave\/second$/,
			);
		},
	);

	catalogTest("creating an article puts the card on the new one", async ({ basePage, catalogPage, sharedPage }) => {
		await expect(sharedPage.getByText("first body")).toBeVisible();
		await slowDownReadsOf(sharedPage, "/card-leave/first");

		await catalogPage.createRootArticle();
		await slowReadsLanded(sharedPage);
		expect((await slowReads(sharedPage)).started, "the page being left is not read again").toBe(0);

		await basePage.navigate("/");
		await expect(sharedPage.getByRole("link", { name: "Card Leave" })).toHaveAttribute(
			"href",
			/\/card-leave\/untitled$/,
		);
	});

	catalogTest(
		"leaving an article with a template open puts the card on the next one",
		async ({ basePage, sharedPage }) => {
			await expect(sharedPage.getByText("first body")).toBeVisible();
			await navItem(sharedPage, "First").hover();
			await articleActionsButton(sharedPage, "First").click();
			await sharedPage.getByRole("menuitem", { name: "Choose template" }).click();
			await sharedPage.getByRole("menuitem", { name: "Manage templates" }).click();
			await sharedPage.getByRole("dialog", { name: "Templates" }).getByText("Leave Template").click();
			await expect(sharedPage.getByText("first body")).toBeHidden();
			await slowDownReadsOf(sharedPage, "/card-leave/first");

			await navItem(sharedPage, "Second").click();
			await expect(sharedPage.getByText("second body")).toBeVisible();
			await slowReadsLanded(sharedPage);
			expect((await slowReads(sharedPage)).started, "closing the template read the page being left").toBe(1);

			await basePage.navigate("/");
			await expect(sharedPage.getByRole("link", { name: "Card Leave" })).toHaveAttribute(
				"href",
				/\/card-leave\/second$/,
			);
		},
	);
});
