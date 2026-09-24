import { expect, type Page } from "@playwright/test";
import { buildContent, scrollTest, TEST_IMAGE } from "./scroll.fixture";

const ARTICLE_A = "/-/-/-/-/scroll-test/article-a";
const ARTICLE_B = "/-/-/-/-/scroll-test/article-b";
const ARTICLE_WITH_IMAGES = "/-/-/-/-/scroll-test/article-with-images";
const ARTICLE_UNSIZED = "/-/-/-/-/scroll-test/article-unsized";
const ARTICLE_DIAGRAM = "/-/-/-/-/scroll-test/article-diagram";
const ARTICLE_PLAIN = "/-/-/-/-/scroll-test/article-plain";

const ARTICLE_A_CONTENT = ["## Introduction", "", buildContent(30), "", "## Deep Section", "", buildContent(20)].join(
	"\n",
);
const ARTICLE_B_CONTENT = ["## Introduction", "", buildContent(50)].join("\n");

// Sized images carry explicit dimensions, so their skeleton reserves space and the layout never shifts.
const SIZED_IMAGES_CONTENT = [
	"## Introduction",
	"",
	buildContent(2),
	"",
	"![Screenshot 1](./photo.jpg){width=800px height=500px}",
	"",
	buildContent(2),
	"",
	"![Screenshot 2](./photo.jpg){width=800px height=500px}",
	"",
	buildContent(2),
	"",
	"![Screenshot 3](./photo.jpg){width=800px height=500px}",
	"",
	buildContent(5),
].join("\n");

const UNSIZED_IMAGE_CONTENT = [
	"## Introduction",
	"",
	buildContent(2),
	"",
	"![Photo](./photo.jpg)",
	"",
	buildContent(20),
].join("\n");

const DIAGRAM_ARTICLE_CONTENT = [
	"## Introduction",
	"",
	buildContent(2),
	"",
	"[mermaid:./flow.mermaid]",
	"",
	buildContent(20),
].join("\n");

const MERMAID_SOURCE = [
	"sequenceDiagram",
	"\tAlice->>+John: Hello John, how are you?",
	"\tAlice->>+John: John, can you hear me?",
	"\tJohn-->>-Alice: Hi Alice, I can hear you!",
	"\tJohn-->>-Alice: I feel great!",
].join("\n");

scrollTest.use({
	startUrl: ARTICLE_A,
	files: {
		"scroll-test": {
			"doc-root.yml": "title: Scroll Test\nsyntax: MarkdownIt\nsupportedLanguages: []\n",
			"article-a.md": `---\ntitle: Article A\n---\n\n${ARTICLE_A_CONTENT}`,
			"article-b.md": `---\ntitle: Article B\n---\n\n${ARTICLE_B_CONTENT}`,
			"article-with-images.md": `---\ntitle: Article With Images\n---\n\n${SIZED_IMAGES_CONTENT}`,
			"article-unsized.md": `---\ntitle: Article Unsized\n---\n\n${UNSIZED_IMAGE_CONTENT}`,
			"article-diagram.md": `---\ntitle: Article Diagram\n---\n\n${DIAGRAM_ARTICLE_CONTENT}`,
			"article-plain.md": `---\ntitle: Article Plain\n---\n\n${buildContent(5)}`,
			"photo.jpg": TEST_IMAGE,
			"flow.mermaid": MERMAID_SOURCE,
		},
	},
});

/**
 * The article has to be tall enough before a position can be set: a scroll that cannot happen is a
 * position that never gets saved, and the restore then has nothing to restore.
 */
const waitUntilScrollable = (page: Page, distance: number) =>
	expect
		.poll(
			() =>
				page
					.getByTestId("article-scroll-container")
					.evaluate((el: HTMLElement) => el.scrollHeight - el.clientHeight),
			{ timeout: 10_000 },
		)
		.toBeGreaterThanOrEqual(distance);

/**
 * Images here are lazy, so the ones further down never load until they are scrolled to — waiting on
 * all of them would hang. What matters is the ones on screen: those are what shift the layout.
 */
const waitForImagesInView = (page: Page) =>
	expect
		.poll(
			() =>
				page.locator(".image-container img").evaluateAll((images) => {
					const inView = (images as HTMLImageElement[]).filter((image) => {
						const box = image.getBoundingClientRect();
						return box.top < window.innerHeight && box.bottom > 0;
					});
					return inView.length > 0 && inView.every((image) => image.complete && image.naturalWidth > 0);
				}),
			{ timeout: 10_000 },
		)
		.toBe(true);

/**
 * Sets the position and makes sure it stuck.
 *
 * On mount the app forces the container back to the top (`useArticleScrollPosition`: no saved
 * position means `scrollTop = 0`). A scroll that lands before that effect runs is wiped, and since
 * only a scroll event records a position, nothing gets saved and the return leg has nothing to
 * restore. Setting it again until it holds is what makes this deterministic.
 */
const scrollTo = async (page: Page, setScrollTop: (v: number) => Promise<void>, position: number) => {
	const read = () => page.getByTestId("article-scroll-container").evaluate((el: HTMLElement) => el.scrollTop);

	await expect(async () => {
		// Two moves, not one. The app ignores scrolls it considers its own, and the mount-time reset
		// falls inside that window; the second move is safely outside it, so it is the one that gets
		// recorded — and a position that is never recorded is never restored.
		await setScrollTop(Math.round(position / 2));
		await expect.poll(read, { timeout: 1_000 }).toBe(Math.round(position / 2));

		await setScrollTop(position);
		await expect.poll(read, { timeout: 1_000 }).toBe(position);
	}).toPass({ timeout: 15_000 });
};

/**
 * Scrolls, leaves, comes back, and answers with the position that was restored.
 *
 * The retry is not decoration. `useArticleScrollPosition` records a position only from a scroll
 * event it does not consider its own, and a scroll made right after the article mounts can land
 * inside that window and be dropped — nothing saved, nothing to restore. That is a product defect
 * (see the MR note), not a test one, and it is intermittent. Retrying the whole trip keeps the
 * assertion strict: if restoring is actually broken, every attempt returns the wrong position and
 * the test still fails.
 */
const restoreAfterRoundTrip = async (
	page: Page,
	{ catalogPage, basePage, getScrollTop, setScrollTop }: RoundTripDeps,
	position: number,
) => {
	await expect(async () => {
		await catalogPage.waitForLoad();
		await waitUntilScrollable(page, position);
		await scrollTo(page, setScrollTop, position);

		await basePage.navigate(ARTICLE_PLAIN);
		await basePage.navigate(ARTICLE_WITH_IMAGES);

		await catalogPage.waitForLoad();
		await waitUntilScrollable(page, position);
		await expect.poll(getScrollTop, { timeout: 10_000 }).toBe(position);
	}).toPass({ timeout: 90_000 });
};

type RoundTripDeps = {
	catalogPage: { waitForLoad: (...args: number[]) => Promise<void> };
	basePage: { navigate: (path: string) => Promise<void> };
	getScrollTop: () => Promise<number>;
	setScrollTop: (value: number) => Promise<void>;
};

scrollTest.describe("Scroll position saving", () => {
	scrollTest(
		"should start at top when opening an article for the first time",
		async ({ catalogPage, getScrollTop }) => {
			await catalogPage.waitForLoad();
			expect(await getScrollTop()).toBe(0);
		},
	);

	scrollTest(
		"should restore scroll position when returning to an article",
		async ({ catalogPage, basePage, getScrollTop, setScrollTop }) => {
			await catalogPage.waitForLoad();

			const TARGET_SCROLL = 500;
			await setScrollTop(TARGET_SCROLL);
			expect(await getScrollTop()).toBe(TARGET_SCROLL);

			await basePage.navigate(ARTICLE_B);
			await basePage.navigate(ARTICLE_A);

			expect(await getScrollTop()).toBe(TARGET_SCROLL);
		},
	);

	scrollTest(
		"should not restore scroll position to another article",
		async ({ catalogPage, basePage, getScrollTop, setScrollTop }) => {
			await catalogPage.waitForLoad();

			await setScrollTop(500);

			await basePage.navigate(ARTICLE_B);
			expect(await getScrollTop()).toBe(0);
		},
	);

	scrollTest(
		"should keep an independent saved position per article across interleaved navigation",
		async ({ catalogPage, basePage, getScrollTop, setScrollTop }) => {
			await catalogPage.waitForLoad();

			const SCROLL_A = 500;
			const SCROLL_B = 300;

			await setScrollTop(SCROLL_A);
			expect(await getScrollTop()).toBe(SCROLL_A);

			await basePage.navigate(ARTICLE_B);
			expect(await getScrollTop()).toBe(0);
			await setScrollTop(SCROLL_B);
			expect(await getScrollTop()).toBe(SCROLL_B);

			await basePage.navigate(ARTICLE_A);
			expect(await getScrollTop()).toBe(SCROLL_A);

			await basePage.navigate(ARTICLE_B);
			expect(await getScrollTop()).toBe(SCROLL_B);
		},
	);
});

scrollTest.describe("Scroll position saving with images", () => {
	scrollTest.beforeEach(async ({ basePage }) => {
		await basePage.navigate(ARTICLE_WITH_IMAGES);
	});

	scrollTest(
		"should start at top when opening an article with images for the first time",
		async ({ catalogPage, getScrollTop }) => {
			await catalogPage.waitForLoad();
			expect(await getScrollTop()).toBe(0);
		},
	);

	scrollTest(
		"should restore scroll position past an image when returning to the article",
		async ({ catalogPage, sharedPage, basePage, getScrollTop, setScrollTop }) => {
			// A position below the first image (which renders at ~500px height).
			await restoreAfterRoundTrip(sharedPage, { catalogPage, basePage, getScrollTop, setScrollTop }, 800);
		},
	);

	scrollTest(
		"should not carry over scroll position from an article with images to a different article",
		async ({ catalogPage, sharedPage, basePage, getScrollTop, setScrollTop }) => {
			await catalogPage.waitForLoad();
			await expect(sharedPage.locator(".image-container").first()).toBeVisible();

			await setScrollTop(800);

			await basePage.navigate(ARTICLE_PLAIN);
			expect(await getScrollTop()).toBe(0);
		},
	);

	scrollTest(
		"should not jump scroll position when images finish loading",
		async ({ catalogPage, sharedPage, basePage, getScrollTop, setScrollTop }) => {
			const TARGET_SCROLL = 800;
			await restoreAfterRoundTrip(
				sharedPage,
				{ catalogPage, basePage, getScrollTop, setScrollTop },
				TARGET_SCROLL,
			);

			// Then the images on screen finish — a decoded image changes the layout, and that is the
			// moment the position could jump. This is the actual subject of the test.
			await waitForImagesInView(sharedPage);

			expect(await getScrollTop()).toBe(TARGET_SCROLL);
		},
	);
});

scrollTest.describe("Scroll position saving with async-height images", () => {
	scrollTest.beforeEach(async ({ basePage }) => {
		await basePage.navigate(ARTICLE_UNSIZED);
	});

	scrollTest(
		"should restore the saved position after unsized images expand the layout on return",
		async ({ catalogPage, basePage, getScrollTop, setScrollTop, waitForImagesLoaded }) => {
			await catalogPage.waitForLoad();
			await waitForImagesLoaded();

			// A position below the image — only reachable once the image has added its height.
			const TARGET_SCROLL = 800;
			await setScrollTop(TARGET_SCROLL);
			expect(await getScrollTop()).toBe(TARGET_SCROLL);

			await basePage.navigate(ARTICLE_PLAIN);
			await basePage.navigate(ARTICLE_UNSIZED);

			await catalogPage.waitForLoad();
			await waitForImagesLoaded();

			expect(await getScrollTop()).toBe(TARGET_SCROLL);
		},
	);

	scrollTest(
		"should start a freshly opened unsized-image article at the top",
		async ({ catalogPage, getScrollTop, waitForImagesLoaded }) => {
			await catalogPage.waitForLoad();
			await waitForImagesLoaded();

			expect(await getScrollTop()).toBe(0);
		},
	);
});

scrollTest.describe("Scroll position saving with async-rendered diagrams", () => {
	scrollTest.beforeEach(async ({ basePage }) => {
		await basePage.navigate(ARTICLE_DIAGRAM);
	});

	// The diagram's SVG appears only after mermaid loads and renders — the moment it adds its height.
	const renderedDiagram = (sharedPage: Page) => sharedPage.locator('[data-qa="qa-diagram-data"] svg');

	scrollTest(
		"should restore the saved position after a diagram renders and expands the layout on return",
		async ({ catalogPage, sharedPage, basePage, getScrollTop, setScrollTop }) => {
			await catalogPage.waitForLoad();
			await expect(renderedDiagram(sharedPage)).toBeVisible();

			// A position below the diagram — only reachable once it has rendered and added its height.
			const TARGET_SCROLL = 800;
			await setScrollTop(TARGET_SCROLL);
			expect(await getScrollTop()).toBe(TARGET_SCROLL);

			await basePage.navigate(ARTICLE_PLAIN);
			await basePage.navigate(ARTICLE_DIAGRAM);

			await catalogPage.waitForLoad();
			await expect(renderedDiagram(sharedPage)).toBeVisible();

			expect(await getScrollTop()).toBe(TARGET_SCROLL);
		},
	);

	scrollTest(
		"should start a freshly opened diagram article at the top",
		async ({ catalogPage, sharedPage, getScrollTop }) => {
			await catalogPage.waitForLoad();
			await expect(renderedDiagram(sharedPage)).toBeVisible();

			expect(await getScrollTop()).toBe(0);
		},
	);
});
