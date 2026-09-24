import { expect, type Locator, type Page } from "@playwright/test";
import { evaluateOnApp } from "@utils/app";
import { gitTest as test } from "@web/fixtures/git.fixture";
import type CatalogPage from "@web/pom/catalog.page";
import { ArticleEditorPom } from "@web/pom/editor.pom";
import type { FileTree } from "@web/utils";
import { readFileSync } from "fs";
import { readFile } from "fs/promises";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { ARTICLE, ARTICLE_TITLE, prepareLinkedCatalog, remoteCatalogUrl } from "../../git/catalog-setup";

// Product modules cannot be plain-imported here: the Playwright runtime transpiles everything
// outside `e2e-pw` to CommonJS, and its ESM loader sees no named exports on the result.
const nodeRequire = createRequire(import.meta.url);

const { isLikelyLfsPointer } = nodeRequire(
	"@core/GitLfs/logic/isLikelyLfsPointer",
) as typeof import("@core/GitLfs/logic/isLikelyLfsPointer");

const { compressOptionsFor, optimalCompressRules } = nodeRequire(
	"@core/FileProvider/model/CompressOptions",
) as typeof import("@core/FileProvider/model/CompressOptions");

const COMMAND_MODULE = "@app/commands/versionControl/lfs/enableAutoLfsAttachments";

/**
 * The wording the catalog path commits under, taken from the command that owns it. Running that
 * module here is not an option — its import graph reaches `import.meta.env`, which the CommonJS
 * output above cannot evaluate — so the declaration is read out of the source the alias resolves
 * to. Either way the assertion follows the constant instead of a copy of it.
 */
const readLfsCommitMessage = (): string => {
	const source = readFileSync(nodeRequire.resolve(COMMAND_MODULE), "utf8");
	const declared = /LFS_ATTACHMENTS_COMMIT_MESSAGE = "([^"]+)"/.exec(source);
	if (!declared) throw new Error("LFS_ATTACHMENTS_COMMIT_MESSAGE is no longer a readable string literal");
	return declared[1];
};

const LFS_COMMIT_MESSAGE = readLfsCommitMessage();

const IMAGE_FIXTURE = new URL("./data/attachment.png", import.meta.url);

const DOC_ROOT = ".doc-root.yaml";
const SEED_ATTACHMENT = "seed.png";
/** An attachment the user has just added and not published; its bytes never have to be an image. */
const PENDING_ATTACHMENT = "just-added.png";
const PENDING_ATTACHMENT_BYTES = "added, not published";
const SEED_MASK = "*.png filter=lfs";

/**
 * The type a pasted attachment lands as. Not the fixture's own: the editor re-encodes images through
 * the optimal compression preset, so the mask the catalog gets is named after the preset's target.
 * Read from the preset rather than copied, because a change of target has already outrun a copy once.
 */
const pastedTarget = compressOptionsFor(optimalCompressRules(), "png")?.target;
if (!pastedTarget) throw new Error("the optimal compression preset no longer re-encodes png");

const ATTACHMENT_TYPE = `*.${pastedTarget}`;
const ATTACHMENT_MASK = `${ATTACHMENT_TYPE} filter=lfs`;

const SEEDED_LFS_LINE =
	"assets/Marketing_Renders_2026_Q3_Client_Approved_Final_Delivery/*.exr filter=lfs diff=lfs merge=lfs -text";

const NARROW_VIEWPORT = { width: 360, height: 800 };

const AUTO_SWITCH = /Store new attachments in LFS/;

const DEFAULT_EXCLUDE = ["*.svg", "*.puml", "*.yaml", "*.mermaid", "*.html"];

declare global {
	interface Window {
		collapseFrames: { heights: number[]; done: boolean };
	}
}

test.use({ isolated: false });
test.describe.configure({ mode: "serial" });

let catalogName: string;

const seedFiles = async (): Promise<FileTree> => {
	const bytes = [...new Uint8Array(await readFile(fileURLToPath(IMAGE_FIXTURE)))];

	return {
		[catalogName]: {
			[DOC_ROOT]: `title: ${catalogName}\nsyntax: xml\n`,
			".gitattributes": `${SEEDED_LFS_LINE}\n`,
			[`${ARTICLE}.md`]: `---\ntitle: ${ARTICLE_TITLE}\n---\n\n![](./${SEED_ATTACHMENT})\n`,
			[SEED_ATTACHMENT]: bytes,
		},
	};
};

const readGitAttributes = (page: Page): Promise<string> =>
	evaluateOnApp(
		page,
		async (catalog: string) => {
			const { wm } = await window.app!;
			const fp = wm.current().getFileProvider();
			const path = window.debug.intoPath(`${catalog}/.gitattributes`);
			return (await fp.exists(path)) ? await fp.read(path) : "";
		},
		catalogName,
	);

const headCommitSummary = (page: Page): Promise<string> =>
	evaluateOnApp(
		page,
		async (catalog: string) => {
			const { wm } = await window.app!;
			const { gvc } = (await wm.current().getContextlessCatalog(catalog)).repo;
			const { data } = await gvc.getCommitInfo(await gvc.getHeadCommit(), 1);
			return data[0]?.summary ?? "";
		},
		catalogName,
	);

const headCommitOid = (page: Page): Promise<string> =>
	evaluateOnApp(
		page,
		async (catalog: string) => {
			const { wm } = await window.app!;
			const { gvc } = (await wm.current().getContextlessCatalog(catalog)).repo;
			return (await gvc.getHeadCommit()).toString();
		},
		catalogName,
	);

/** Repo-relative paths the Publish panel would list — what the catalog still owes the remote. */
const pendingChanges = (page: Page): Promise<string[]> =>
	evaluateOnApp(
		page,
		async (catalog: string) => {
			const { wm } = await window.app!;
			const { gvc } = (await wm.current().getContextlessCatalog(catalog)).repo;
			return (await gvc.getChanges("workdir")).map((change) => change.path.value);
		},
		catalogName,
	);

/**
 * The blob HEAD holds for `file`, raw. The tree reader behind `RustFs.git` smudges a pointer back
 * into the content whenever the LFS object sits in the local store — which right after a migration
 * it always does — so it can never tell a pointer apart from the file. `showFileContent` reads the
 * blob itself, which is the thing the migration is supposed to have replaced.
 */
const readHeadBlob = (page: Page, file: string): Promise<string> =>
	evaluateOnApp(
		page,
		async ({ catalog, path }: { catalog: string; path: string }) => {
			const { wm } = await window.app!;
			const { gvc } = (await wm.current().getContextlessCatalog(catalog)).repo;
			return gvc.showFileContent(window.debug.intoPath(path), await gvc.getHeadCommit());
		},
		{ catalog: catalogName, path: file },
	);

/** Repo-relative paths the HEAD commit actually carries — its own contents, not the repository's. */
const headCommitFiles = (page: Page): Promise<string[]> =>
	evaluateOnApp(
		page,
		async (catalog: string) => {
			const { wm } = await window.app!;
			const { gvc } = (await wm.current().getContextlessCatalog(catalog)).repo;
			const head = await gvc.getHeadCommit();
			const parent = await gvc.getParentCommitHash(head);
			const { files } = await gvc.diff({
				compare: { type: "tree", new: head.toString(), old: parent.toString() },
				renames: false,
				useMergeBase: false,
			});
			return files.map((file) => file.path.value);
		},
		catalogName,
	);

/** Rewrites a file through the app, leaving it exactly as pending as a user's own edit would. */
const rewriteFile = (page: Page, file: string, content: string): Promise<void> =>
	evaluateOnApp(
		page,
		async ({ catalog, path, text }: { catalog: string; path: string; text: string }) => {
			const { wm } = await window.app!;
			await wm
				.current()
				.getFileProvider()
				.write(window.debug.intoPath(`${catalog}/${path}`), text);
		},
		{ catalog: catalogName, path: file, text: content },
	);

const openArticle = async (catalogPage: CatalogPage, sharedPage: Page) => {
	await catalogPage.goto(remoteCatalogUrl(catalogName));
	await sharedPage.reload();
	await catalogPage.waitForLoad();
};

const openLfsSettings = async (catalogPage: CatalogPage, sharedPage: Page) => {
	await openArticle(catalogPage, sharedPage);

	let catalogActions = sharedPage.locator('[data-testid="catalog-actions"]:visible').first();
	if (!(await catalogActions.count())) {
		await sharedPage.getByRole("button", { name: "Expand sidebar", exact: true }).click();
		catalogActions = sharedPage.locator('[data-testid="catalog-actions"]:visible').first();
	}
	await catalogActions.click();
	await sharedPage.getByRole("menuitem", { name: /Configure catalog/ }).click();
	await expect(catalogPage.modal.getByText("Catalog Settings", { exact: true })).toBeVisible();
	await catalogPage.modal.getByRole("button", { name: "Git LFS", exact: true }).click();

	return catalogPage.modal.getByRole("switch", { name: AUTO_SWITCH });
};

const excludeInput = (catalogPage: CatalogPage) => catalogPage.modal.getByRole("textbox", { name: "Exceptions" });

// By role and accessible name — which also asserts the field's label actually names its input. Both
// lists share a placeholder, so nothing else here tells them apart.
const patternsField = (catalogPage: CatalogPage) =>
	catalogPage.modal.getByRole("textbox", { name: "Tracked LFS files" });

const tag = (catalogPage: CatalogPage, name: string) => catalogPage.modal.getByText(name, { exact: true });

const pasteAttachment = async (catalogPage: CatalogPage, sharedPage: Page) => {
	await openArticle(catalogPage, sharedPage);

	const editor = new ArticleEditorPom(catalogPage);
	await editor.setMarkdown("(*)");
	await editor.focus();

	await catalogPage.copyFileToClipboard(IMAGE_FIXTURE);
	await editor.press("ControlOrMeta+V");

	await expect(sharedPage.getByTestId("image")).toHaveCount(1);
	await catalogPage.waitForLoad();
};

type Box = { x: number; y: number; width: number; height: number };

const boxOf = async (locator: Locator, what: string): Promise<Box> => {
	const box = await locator.boundingBox();
	expect(box, `${what} has no bounding box`).not.toBeNull();
	return box;
};

const settle = (dialog: Locator): Promise<unknown> =>
	dialog.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));

const collapseFrames = async (page: Page, trigger: Locator, collapse: () => Promise<void>): Promise<number[]> => {
	const panelId = await trigger.getAttribute("aria-controls");
	expect(panelId, "the disclosure trigger has to name its panel").toBeTruthy();

	await page.evaluate((id) => {
		window.collapseFrames = { heights: [], done: false };
		const until = performance.now() + 2000;
		const tick = () => {
			window.collapseFrames.heights.push(document.getElementById(id)?.getBoundingClientRect().height ?? 0);
			if (performance.now() < until) requestAnimationFrame(tick);
			else window.collapseFrames.done = true;
		};
		requestAnimationFrame(tick);
	}, panelId);

	await collapse();
	await page.waitForFunction(() => window.collapseFrames.done, undefined, { timeout: 15_000 });

	return page.evaluate(() => window.collapseFrames.heights);
};

const pageScrollWidth = (page: Page): Promise<number> => page.evaluate(() => document.documentElement.scrollWidth);

const expectInside = (child: Box, parent: Box, what: string) => {
	expect(child.x, `${what}: left edge`).toBeGreaterThanOrEqual(parent.x - 1);
	expect(child.y, `${what}: top edge`).toBeGreaterThanOrEqual(parent.y - 1);
	expect(child.x + child.width, `${what}: right edge`).toBeLessThanOrEqual(parent.x + parent.width + 1);
	expect(child.y + child.height, `${what}: bottom edge`).toBeLessThanOrEqual(parent.y + parent.height + 1);
};

type TextStyle = { color: string; fontSize: string };

const textStyleOf = (locator: Locator): Promise<TextStyle> =>
	locator.evaluate((el) => {
		const style = getComputedStyle(el);
		return { color: style.color, fontSize: style.fontSize };
	});

/**
 * Distance from the bottom of the disclosure trigger to the first row inside its panel. The panel
 * box itself opens flush against the trigger: the spacing sits on the wrapper within it, so that it
 * grows and shrinks with the panel instead of snapping once the panel is hidden.
 */
const triggerToDetailsGap = async (page: Page, trigger: Locator): Promise<number> => {
	const panelId = await trigger.getAttribute("aria-controls");
	expect(panelId, "the disclosure trigger has to name its panel").toBeTruthy();
	// Radix ids carry colons, which a `#id` selector cannot hold. Wait out the panel's own animation
	// only — the dialog subtree also carries the skeletons' endless pulse.
	await page.locator(`[id="${panelId}"]`).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));

	// Both rects in one frame: an opening panel keeps moving the vertically centred dialog under them.
	return trigger.evaluate((el, id) => {
		const row = document.getElementById(id)?.firstElementChild?.firstElementChild;
		if (!row) throw new Error("the disclosure panel has no row to measure against");
		return row.getBoundingClientRect().top - el.getBoundingClientRect().bottom;
	}, panelId);
};

/** Reads what a stock ui-kit confirm renders its body as, then leaves it as it found it. */
const canonicalDialogBody = async (catalogPage: CatalogPage, sharedPage: Page): Promise<TextStyle> => {
	const actions = await catalogPage.getArticleActions(ARTICLE_TITLE);
	await actions.open();
	await (await actions.findItemByTitle("Delete")).click();

	const dialog = sharedPage.getByRole("alertdialog");
	await expect(dialog).toBeVisible();
	const style = await textStyleOf(dialog.locator("p").first());

	await sharedPage.keyboard.press("Escape");
	await expect(dialog).toBeHidden();

	return style;
};

test.describe("auto-LFS for new attachments", () => {
	test("links a fresh catalog to its repository", async ({ catalogPage, sharedPage, tempRepoName }) => {
		test.slow();

		catalogName = tempRepoName;
		await prepareLinkedCatalog(catalogPage, sharedPage, { name: catalogName, files: await seedFiles() });
	});

	test("turning the switch on asks for confirmation, and cancelling changes nothing", async ({
		catalogPage,
		sharedPage,
	}) => {
		const autoSwitch = await openLfsSettings(catalogPage, sharedPage);
		await autoSwitch.click();

		const dialog = sharedPage.getByRole("alertdialog");
		await expect(dialog).toBeVisible({ timeout: 30_000 });
		await expect(dialog.getByText("Move attachments to Git LFS?")).toBeVisible();

		await dialog.getByRole("button", { name: "Cancel" }).click();
		await expect(dialog).toBeHidden();
		await expect(autoSwitch).not.toBeChecked();

		await sharedPage.keyboard.press("Escape");
		await expect(catalogPage.modal).toBeHidden();

		expect(await catalogPage.catalog(catalogName).props()).not.toMatchObject({ lfs: { auto: true } });
	});

	test("the dialog's body reads the way every other modal's does", async ({ catalogPage, sharedPage }) => {
		await openArticle(catalogPage, sharedPage);
		const canonical = await canonicalDialogBody(catalogPage, sharedPage);

		const autoSwitch = await openLfsSettings(catalogPage, sharedPage);
		await autoSwitch.click();

		const dialog = sharedPage.getByRole("alertdialog");
		await expect(dialog).toBeVisible({ timeout: 30_000 });

		const title = await textStyleOf(dialog.getByRole("heading"));
		const body = await textStyleOf(dialog.locator("p").first());
		const details = dialog.getByRole("button", { name: "Technical details" });
		const trigger = await textStyleOf(details);

		expect(body.fontSize, "the body is set at the size every other modal sets its body").toBe(canonical.fontSize);
		expect(body.color, "the body reads as dark as the dialog's own title").toBe(title.color);
		expect(trigger.color, "the details trigger takes the kit's own muted grey, not a hand-picked one").toBe(
			canonical.color,
		);
		expect(trigger.fontSize, "the details trigger reads at the body's size").toBe(body.fontSize);

		await details.click();
		await expect(dialog.getByRole("region", { name: ".gitattributes" })).toBeVisible();

		expect(await triggerToDetailsGap(sharedPage, details), "the panel is spaced off its trigger").toBeGreaterThan(
			0,
		);

		await dialog.getByRole("button", { name: "Cancel" }).click();
		await expect(dialog).toBeHidden();
		await sharedPage.keyboard.press("Escape");
		await expect(catalogPage.modal).toBeHidden();
	});

	test("at a narrow viewport the dialog keeps its content inside itself, and its details stay shut", async ({
		catalogPage,
		sharedPage,
	}) => {
		const wideViewport = sharedPage.viewportSize();
		await sharedPage.setViewportSize(NARROW_VIEWPORT);

		try {
			const autoSwitch = await openLfsSettings(catalogPage, sharedPage);
			const pageBeforeDialog = await pageScrollWidth(sharedPage);
			await autoSwitch.click();

			const dialog = sharedPage.getByRole("alertdialog");
			await expect(dialog).toBeVisible({ timeout: 30_000 });

			const details = dialog.getByRole("button", { name: "Technical details" });
			const migrate = dialog.getByRole("button", { name: "Move files" });
			const cancel = dialog.getByRole("button", { name: "Cancel" });
			const diff = dialog.getByRole("region", { name: ".gitattributes" });

			await details.click();
			await expect(diff).toBeVisible();
			await settle(dialog);

			const expanded = await boxOf(dialog, "dialog");

			const content = await diff.evaluate((el) => el.scrollWidth);
			expect(content, "the seeded .gitattributes line has to be wider than the dialog").toBeGreaterThan(
				expanded.width,
			);

			const scrolls = await diff.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
			expect(scrolls, "a line that does not fit has to scroll inside its box").toBe(true);

			expectInside(expanded, { x: 0, y: 0, ...NARROW_VIEWPORT }, "dialog inside the viewport");
			expectInside(await boxOf(diff, "diff"), expanded, "diff");
			expectInside(await boxOf(details, "details trigger"), expanded, "details trigger");
			expectInside(await boxOf(migrate, "migrate button"), expanded, "migrate button");
			expectInside(await boxOf(cancel, "cancel button"), expanded, "cancel button");

			const outsideDialog = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
			expect(outsideDialog, "nothing may stick out of the dialog box").toBeLessThanOrEqual(0);

			expect(await pageScrollWidth(sharedPage), "the dialog must not widen the page").toBeLessThanOrEqual(
				pageBeforeDialog,
			);

			const expandedMigrate = await boxOf(migrate, "migrate button");

			const frames = await collapseFrames(sharedPage, details, () => details.click());
			const closed = frames.findIndex((height) => height < 0.5);
			expect(closed, "the details panel has to collapse to nothing").toBeGreaterThanOrEqual(0);
			expect(Math.max(...frames.slice(closed)), "a collapsed panel may not come back").toBeLessThan(0.5);

			await expect(diff).toBeHidden();
			await settle(dialog);

			const collapsed = await boxOf(dialog, "dialog");
			const collapsedMigrate = await boxOf(migrate, "migrate button");
			expect(collapsedMigrate.y, "the footer follows the panel that closed above it").toBeLessThan(
				expandedMigrate.y,
			);
			expectInside(collapsedMigrate, collapsed, "migrate button, details collapsed");

			await cancel.click();
			await expect(dialog).toBeHidden();
			await sharedPage.keyboard.press("Escape");
			await expect(catalogPage.modal).toBeHidden();
		} finally {
			await sharedPage.setViewportSize(wideViewport);
		}
	});

	test("confirming saves the setting without the form's Save button", async ({ catalogPage, sharedPage }) => {
		test.slow();

		// Alongside the published attachment, one the user has just added and not published — the state
		// the owner hit, and the one thing the migration must not touch.
		await openArticle(catalogPage, sharedPage);
		await rewriteFile(sharedPage, PENDING_ATTACHMENT, PENDING_ATTACHMENT_BYTES);
		expect(await pendingChanges(sharedPage), "the new attachment starts out pending").toContain(PENDING_ATTACHMENT);

		const autoSwitch = await openLfsSettings(catalogPage, sharedPage);
		await autoSwitch.click();

		const dialog = sharedPage.getByRole("alertdialog");
		await expect(dialog).toBeVisible({ timeout: 30_000 });

		await dialog.getByRole("button", { name: "Move files" }).click();
		await expect(dialog).toBeHidden({ timeout: 60_000 });
		await expect(autoSwitch).toBeChecked();

		await sharedPage.keyboard.press("Escape");
		await expect(catalogPage.modal).toBeHidden();

		// The defaults are not written down — they hold for every catalog — so the block stores no list.
		expect(await catalogPage.catalog(catalogName).props()).toMatchObject({
			lfs: { auto: true, exclude: [] },
		});
		expect(await readGitAttributes(sharedPage)).toContain(SEED_MASK);

		expect(await headCommitSummary(sharedPage), "the migration lands as its own service commit").toBe(
			LFS_COMMIT_MESSAGE,
		);

		const committed = await headCommitFiles(sharedPage);
		expect(committed, "the service commit carries the attachments that changed storage").toEqual(
			expect.arrayContaining([DOC_ROOT, ".gitattributes", SEED_ATTACHMENT]),
		);
		expect(committed, "and none of the work the user has not published").not.toContain(PENDING_ATTACHMENT);

		const blob = Buffer.from(await readHeadBlob(sharedPage, SEED_ATTACHMENT), "binary");
		expect(isLikelyLfsPointer(blob), "the committed attachment is an LFS pointer, not its own bytes").toBe(true);
		expect(
			await pendingChanges(sharedPage),
			"the new attachment is still the user's to publish, and reaches LFS when they do",
		).toContain(PENDING_ATTACHMENT);

		expect(
			await readHeadBlob(sharedPage, DOC_ROOT),
			"the setting rides in the commit its migration made",
		).toContain("auto: true");
		expect(await pendingChanges(sharedPage), "and so is nothing left for the user to publish").not.toContain(
			DOC_ROOT,
		);
	});

	test("the list carries the defaults, and no key takes one out", async ({ catalogPage, sharedPage }) => {
		await openLfsSettings(catalogPage, sharedPage);

		for (const pattern of DEFAULT_EXCLUDE) await expect(tag(catalogPage, pattern)).toBeVisible();

		const [locked] = DEFAULT_EXCLUDE;
		await tag(catalogPage, locked).click();
		await excludeInput(catalogPage).press("Backspace");

		await expect(tag(catalogPage, locked), "a default is the one exclusion nobody can remove").toBeVisible();

		await sharedPage.keyboard.press("Escape");
		await expect(catalogPage.modal).toBeHidden();
	});

	test("an excluded attachment type gets no mask", async ({ catalogPage, sharedPage }) => {
		await openLfsSettings(catalogPage, sharedPage);

		await excludeInput(catalogPage).fill(ATTACHMENT_TYPE);
		await excludeInput(catalogPage).press("Enter");
		await expect(catalogPage.modal.getByText(ATTACHMENT_TYPE, { exact: true })).toBeVisible();
		await catalogPage.saveSettings();

		const before = await readGitAttributes(sharedPage);
		expect(before).toContain(SEED_MASK);

		await pasteAttachment(catalogPage, sharedPage);

		expect(await readGitAttributes(sharedPage)).toBe(before);
	});

	test("a pasted attachment adds its mask to .gitattributes", async ({ catalogPage, sharedPage }) => {
		await openLfsSettings(catalogPage, sharedPage);

		await catalogPage.modal.getByText(ATTACHMENT_TYPE, { exact: true }).click();
		await excludeInput(catalogPage).press("Backspace");
		await expect(catalogPage.modal.getByText(ATTACHMENT_TYPE, { exact: true })).toBeHidden();
		await catalogPage.saveSettings();

		expect(await readGitAttributes(sharedPage)).not.toContain(ATTACHMENT_MASK);

		await pasteAttachment(catalogPage, sharedPage);

		expect(await readGitAttributes(sharedPage)).toContain(ATTACHMENT_MASK);
	});

	test("turning the switch off shows no dialog, saves with the form, and migrates nothing", async ({
		catalogPage,
		sharedPage,
	}) => {
		const autoSwitch = await openLfsSettings(catalogPage, sharedPage);
		await expect(autoSwitch).toBeChecked();

		const before = await readGitAttributes(sharedPage);

		await autoSwitch.click();
		await expect(autoSwitch).not.toBeChecked();
		await expect(sharedPage.getByRole("alertdialog")).toHaveCount(0);

		expect(await catalogPage.catalog(catalogName).props()).toMatchObject({ lfs: { auto: true } });

		await catalogPage.saveSettings();

		expect(await catalogPage.catalog(catalogName).props()).toMatchObject({ lfs: { auto: false } });
		expect(await readGitAttributes(sharedPage)).toBe(before);
	});

	test("nothing to add means no dialog and no commit at all", async ({ catalogPage, sharedPage }) => {
		const autoSwitch = await openLfsSettings(catalogPage, sharedPage);
		await expect(autoSwitch).not.toBeChecked();

		const before = await readGitAttributes(sharedPage);
		expect(before).toContain(SEED_MASK);
		expect(before).toContain(ATTACHMENT_MASK);
		const head = await headCommitOid(sharedPage);

		await autoSwitch.click();

		await expect(autoSwitch).toBeChecked({ timeout: 30_000 });
		await expect(sharedPage.getByRole("alertdialog")).toHaveCount(0);

		await sharedPage.keyboard.press("Escape");
		await expect(catalogPage.modal).toBeHidden();

		expect(await catalogPage.catalog(catalogName).props()).toMatchObject({ lfs: { auto: true } });
		expect(await readGitAttributes(sharedPage)).toBe(before);

		expect(await headCommitOid(sharedPage), "a migration that had nothing to move makes no commit").toBe(head);
		expect(await pendingChanges(sharedPage), "the setting stays an ordinary pending change").toContain(DOC_ROOT);
	});

	test("the mask list shows only while nothing maintains it", async ({ catalogPage, sharedPage }) => {
		const autoSwitch = await openLfsSettings(catalogPage, sharedPage);
		await expect(autoSwitch).toBeChecked();

		await expect(excludeInput(catalogPage)).toBeVisible();
		await expect(
			patternsField(catalogPage),
			"the auto-add keeps the masks, so they are not the user's to edit",
		).toBeHidden();

		await autoSwitch.click();
		await expect(autoSwitch).not.toBeChecked();

		await expect(patternsField(catalogPage), "switched off, the masks are the whole setting again").toBeVisible();
		await expect(excludeInput(catalogPage)).toBeHidden();

		await catalogPage.saveSettings();
	});
});
