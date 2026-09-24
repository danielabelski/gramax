import { expect, type Locator, type Page as PlaywrightPage } from "@playwright/test";
import type BaseSharedPage from "@shared-pom/page";

/** Repository paths carry `/`, `.` and `-`; a name is pasted into a pattern, so it is escaped first. */
const escapeForRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type CloneOptions = {
	/** Storage name as shown in the select — for GitLab that is the server domain. */
	storage: string;
	group: string;
	repo: string;
};

export type GitLabStorage = {
	domain: string;
	token: string;
	userEmail: string;
};

/**
 * The "Load existing catalog" dialog: picking a storage, picking a repository, cloning, and
 * managing the storages the dialog offers.
 */
export class ClonePom {
	private _raw: PlaywrightPage;

	constructor(private _page: BaseSharedPage) {
		this._raw = _page.raw;
	}

	get dialog(): Locator {
		return this._raw.getByRole("dialog", { name: "Clone Git Repository" });
	}

	get storageSelect(): Locator {
		return this._page.modal.getByRole("combobox", { name: "Storage" });
	}

	get repositorySelect(): Locator {
		return this._page.modal.getByRole("combobox", { name: "Repository" });
	}

	storageOption(name: string): Locator {
		return this._raw.getByRole("option", { name, exact: true });
	}

	/** Opens the dialog. With no storage configured yet it opens straight into "Add new storage". */
	async openMenu(): Promise<void> {
		await this._raw.getByRole("button", { name: "Add catalog" }).click();
		await this._raw.getByRole("menuitem", { name: "Load existing" }).click();
	}

	async open(): Promise<void> {
		await this.openMenu();
		await expect(this.dialog).toBeVisible();
	}

	/**
	 * Fills the "Add new storage" form the dialog shows when no storage is configured yet. The
	 * storage type has to settle before its fields render, so the pick is retried until they do.
	 */
	async addGitLabStorage({ domain, token }: GitLabStorage): Promise<void> {
		const serverUrl = this._raw.getByRole("textbox", {
			name: "GitLab Server URL",
		});

		await expect(async () => {
			// The storage-type select comes from the shared ui-kit and carries no accessible name, so it
			// is reached through the dialog that owns it — the dialog has exactly one combobox.
			//
			// The clicks carry their own budget, well under the one the loop has: the loop is the retry,
			// so an attempt has to give up early enough for the next one to happen. On the CI default a
			// single stuck click would eat half the loop and leave room for one more try.
			await this._raw
				.getByRole("dialog", { name: "Add new storage" })
				.getByRole("combobox")
				.click({ timeout: 5000 });
			await this._raw.getByRole("option", { name: "GitLab" }).click({ timeout: 5000 });
			await expect(serverUrl).toBeVisible({ timeout: 2000 });
		}).toPass({ timeout: 30_000 });

		await serverUrl.fill(domain);
		await this._raw.getByRole("textbox", { name: "GitLab Token" }).fill(token);

		// The author's name and email are derived from the token, so the form fills them itself.
		// Whose address it ends up being depends on the account the token belongs to, so assert that
		// the field got filled rather than pinning it to one address.
		await expect(this._raw.getByRole("textbox", { name: "Email" })).not.toHaveValue("", { timeout: 30_000 });

		await this._raw.getByRole("button", { name: "Add" }).click();
	}

	async selectStorage(name: string): Promise<void> {
		await this.storageSelect.click();
		await this.storageOption(name).click();
	}

	/** Removes a storage through the option's "..." menu. The caller must accept the confirm dialog. */
	async removeStorage(name: string): Promise<void> {
		const option = this.storageOption(name);
		await option.hover();
		// The row is a Radix select item: it selects on pointerup, while the "..." opens its menu
		// on pointerdown. A zero-length synthetic press loses that race and picks the storage
		// instead; a real click always holds long enough. 120ms is a human-speed press.
		await option.getByRole("button", { name: "Storage actions" }).click({ delay: 120 });
		await this._raw.getByRole("menuitem", { name: "Delete" }).click();
	}

	async selectRepository(group: string, repo: string): Promise<void> {
		await this.repositorySelect.click();
		await this._raw.getByPlaceholder("Find").fill(repo);
		// The row reads "<path> <how long ago it changed>", so an exact name never matches — and a loose
		// one matches every repository the wanted name is a prefix of. Anchored at the start and closed
		// with the space that follows the path: a word boundary would not do, since `-` is not a word
		// character and `catalog\b` still matches `catalog-history`.
		await this._raw
			.getByRole("option", { name: new RegExp(`^${escapeForRegExp(`${group}/${repo}`)}(\\s|$)`) })
			.click({ timeout: 30_000 });
	}

	async load(): Promise<void> {
		await this._page.modal.getByRole("button", { name: "Load" }).click();
	}

	async cloneCatalog(opts: CloneOptions): Promise<void> {
		await this.open();
		await this.selectStorage(opts.storage);
		await this.selectRepository(opts.group, opts.repo);
		await this.load();
	}

	/**
	 * Clones through the "Add new storage" form — the shape the dialog takes while nothing is
	 * configured yet.
	 *
	 * Which shape it takes is not up to the test. A worker is reused across serial blocks and the
	 * browser context goes with it, so a block that runs after another clone block finds the storage
	 * that one added: the dialog opens on the storage select, with the wanted storage already in it,
	 * and there is nothing left to add. How the blocks are spread over the workers decides which of
	 * the two a given run gets.
	 */
	async cloneWithNewStorage(storage: GitLabStorage, opts: Omit<CloneOptions, "storage">): Promise<void> {
		await this.openMenu();

		const addStorageForm = this._raw.getByRole("dialog", { name: "Add new storage" });
		await expect(addStorageForm.or(this.storageSelect).first()).toBeVisible({ timeout: 30_000 });

		if (await addStorageForm.isVisible()) await this.addGitLabStorage(storage);
		else await this.selectStorage(storage.domain);

		await this.selectRepository(opts.group, opts.repo);
		await this.load();
	}

	/**
	 * Waits for the cloned catalog's card to appear on the home page and opens it.
	 *
	 * The card appears when the clone *starts*, and a click landing before it finishes is dropped
	 * silently — `apps/web/src/App.tsx` filters out page data while the catalog is still cloning. So
	 * the click is repeated until the address actually changes.
	 */
	async openCatalog(title: string, timeout = 120_000): Promise<void> {
		const card = this._raw.getByRole("button", { name: title });
		await expect(card).toBeVisible({ timeout });

		/** Anything but the home screen means a click was taken and the catalog is opening. */
		const opened = () => new URL(this._raw.url()).pathname !== "/";

		const deadline = Date.now() + timeout;
		while (Date.now() < deadline) {
			if (opened()) return;

			// The click races the navigation it causes: once the catalog opens, the card is gone and
			// clicking it is a timeout rather than a failure worth reporting.
			await card.click({ timeout: 5000 }).catch(() => undefined);
			await this._page.waitForLoad(1000);

			if (opened()) return;

			await this._raw.waitForTimeout(2000);
		}

		throw new Error(`catalog "${title}" stayed on the home screen for ${timeout} ms after being clicked`);
	}
}
