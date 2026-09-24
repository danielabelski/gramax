import { expect, type Locator } from "@playwright/test";
import type { PlaywrightPage } from "@shared-pom/page";

/**
 * The git side of the catalog layout: the status bar at the bottom of the left navigation and the
 * two tabs it opens — "Branches" and "Publish". Each bottom tab is a landmark region named after
 * its own title, and only the shown one is exposed to the accessibility tree.
 */
export class GitPom {
	constructor(private _page: PlaywrightPage) {}

	get branchTrigger(): Locator {
		return this._page.getByRole("button", { name: "Current branch" });
	}

	get publishTrigger(): Locator {
		return this._page.getByRole("button", { name: "Publish changes" });
	}

	get connectStorageTrigger(): Locator {
		return this._page.getByRole("button", { name: "Connect storage" });
	}

	/** Named after `t("sync")`; the counters live inside it as bare digits, without names of their own. */
	get syncTrigger(): Locator {
		return this._page.getByRole("button", { name: "Synchronize" });
	}

	/** The alert a conflicting sync raises before anything can be resolved. */
	get syncConflictAlert(): Locator {
		return this._page.getByRole("alertdialog").filter({ hasText: "Failed to synchronize changes" });
	}

	get conflictResolver(): Locator {
		return this._page.getByRole("dialog", { name: "Resolve conflict" });
	}

	get publishTab(): Locator {
		return this._page.locator('[data-floating-panel-id="publish"]');
	}

	get branchTab(): Locator {
		return this._page.locator('[data-floating-panel-id="branch"]');
	}

	/** The label grows a file count while there are pending changes ("Publish 3"). */
	get publishButton(): Locator {
		return this.publishTab.getByTestId("publish-submit");
	}

	get commitMessageInput(): Locator {
		// The publish panel renders through a portal, outside the status-bar region.
		return this._page.getByRole("textbox", { name: "Comment" });
	}

	get noChanges(): Locator {
		return this.publishTab.getByText("No changes", { exact: true });
	}

	/**
	 * Fills the "Connect storage" dialog of a catalog that has no remote yet. The repository name is
	 * not asked for — it is the catalog name, so the repo ends up at `<group>/<catalog name>`.
	 */
	async connectStorage({ storage, group }: { storage: string; group: string }): Promise<void> {
		await this.connectStorageTrigger.click();

		const modal = this._modal();
		await expect(modal).toBeVisible();

		await modal.getByRole("combobox", { name: "Storage" }).click();
		await this._page.getByRole("option", { name: storage, exact: true }).click();

		await modal.getByRole("combobox", { name: "Group" }).click();
		await this._page.getByPlaceholder("Find").fill(group);
		await this._page.getByRole("option", { name: group, exact: true }).click({ timeout: 15_000 });

		await modal.getByRole("button", { name: "Add" }).click();
	}

	/**
	 * The trigger keeps the branch name as its text; its accessible name stays "Current branch".
	 *
	 * `timeout` is a way out for the callers that wait on a git action rather than on a render — the
	 * default is the ceiling for a label that only has to catch up with the app.
	 */
	async assertCurrentBranch(name: string, timeout = 30_000): Promise<void> {
		await expect(this.branchTrigger).toHaveText(name, { timeout });
	}

	async openBranches(): Promise<void> {
		// The status bar is torn down and rebuilt whenever a git action navigates (`BranchActions`
		// pushes a new path as soon as the checkout answers), so the trigger can be missing for a
		// moment through no fault of the caller. Wait for it rather than let `actionTimeout` decide.
		await expect(this.branchTrigger).toBeVisible({ timeout: 60_000 });
		if (!(await this.branchTab.isVisible())) await this.branchTrigger.click();
		await expect(this.branchTab).toBeVisible();
	}

	async closeBranches(): Promise<void> {
		if (await this.branchTab.isVisible()) await this.branchTrigger.click();
		await expect(this.branchTab).toBeHidden();
	}

	/**
	 * The checkout button filling a row of the branch list. The branch the catalog is currently on
	 * is never listed.
	 *
	 * A row holds two sibling buttons — this one and the "..." menu — which cannot nest, so neither
	 * can scope the other. Each is named after its own branch instead.
	 */
	branchItem(name: string): Locator {
		return this.branchTab.getByTestId("branch-row").filter({ has: this._page.getByText(name, { exact: true }) });
	}

	/** The "..." menu of a row, named per branch so rows stay tellable apart. */
	branchMenuTrigger(name: string): Locator {
		return this.branchTab.getByRole("button", {
			name: `Branch actions: ${name}`,
			exact: true,
		});
	}

	async assertBranchListed(name: string): Promise<void> {
		await this.openBranches();
		await expect(this.branchItem(name)).toBeVisible({ timeout: 30_000 });
	}

	async assertBranchNotListed(name: string): Promise<void> {
		await this.openBranches();
		await expect(this.branchItem(name)).toHaveCount(0, { timeout: 30_000 });
	}

	/** Creates a branch off the current one and checks out onto it. */
	async createBranch(name: string): Promise<void> {
		await this.openBranches();
		await this.branchTab.getByTestId("create-branch").click();

		// The field is mounted by the click above, not present beforehand.
		const input = this.branchTab.getByPlaceholder("Enter branch name");
		await expect(input).toBeVisible({ timeout: 30_000 });
		await input.click();
		await input.fill(name);

		await this.branchTab.getByTestId("create-branch-submit").click();

		// Twice the label's own ceiling, because what is being waited on is not the label. The status
		// bar only shows the new branch once `BranchUpdaterService.updateBranch` answers
		// (`core/extensions/git/actions/Branch/components/BranchTab.tsx:58`), and that call sits behind
		// whatever the catalog is doing against the remote — on the measured catalog of 3446 files the
		// branch appeared 31 s after the click, with an `info/refs` in flight for the whole of it
		// (job 1890800, and the same signature in 1884988). Thirty seconds is that stall almost exactly,
		// so the wait was losing to it by a second and taking a 29-minute job down with it.
		await this.assertCurrentBranch(name, 60_000);
	}

	/**
	 * Checks out `name` and waits for the app to come back.
	 *
	 * The click is made once and never retried: the app pushes a new path as soon as the checkout
	 * answers, so a click that reports a timeout may still have been delivered.
	 *
	 * Both endings count as a landed checkout — the status bar showing the new branch, or the stash
	 * conflict dialog, which stands on the new branch with the label hidden behind it.
	 */
	async switchBranch(name: string): Promise<void> {
		await this.openBranches();
		await expect(this.branchItem(name)).toBeVisible({ timeout: 30_000 });
		await this.branchItem(name).click({ timeout: 30_000 });

		await expect(async () => {
			if (await this.syncConflictAlert.isVisible()) return;
			await expect(this.branchTrigger).toHaveText(name, { timeout: 2000 });
		}).toPass({ timeout: 30_000 });
	}

	async deleteBranch(name: string): Promise<void> {
		await this._openBranchMenu(name);
		await this._page.getByRole("menuitem", { name: "Delete" }).click();

		const confirm = this._page.getByRole("alertdialog");
		await expect(confirm.getByText("Delete branch?")).toBeVisible();
		await confirm.getByRole("button", { name: "Continue" }).click();
		await expect(confirm).toBeHidden({ timeout: 60_000 });
	}

	/** Merges the branch the catalog is on into `target` and checks out `target`. */
	async mergeCurrentInto(target: string, opts?: { deleteAfterMerge?: boolean }): Promise<void> {
		await this._openBranchMenu(target);
		await this._page.getByRole("menuitem", { name: "Instant merge" }).click();

		const modal = this._modal();
		await expect(modal.getByText("Merge branches").first()).toBeVisible();

		if (opts?.deleteAfterMerge) {
			await modal.getByText("Delete branch after merge").click();
			await expect(modal.getByRole("checkbox").first()).toBeChecked();
		}

		await modal.getByRole("button", { name: "Merge" }).click();
	}

	async openPublish(): Promise<void> {
		// The trigger is live before the tab can mount, so a click can land with nothing to show for
		// it. Retry the pair rather than the assertion alone — and keep the click's own budget well
		// under the loop's, so a stuck attempt gives up in time for the next one.
		await expect(async () => {
			if (!(await this.publishTab.isVisible())) await this.publishTrigger.click({ timeout: 5000 });
			await expect(this.publishTab).toBeVisible({ timeout: 2000 });
		}).toPass({ timeout: 30_000 });
	}

	async closePublish(): Promise<void> {
		if (await this.publishTab.isVisible()) await this.publishTrigger.click();
		await expect(this.publishTab).toBeHidden();
	}

	/** Commits and pushes everything the publish tab lists. The tab closes once the push is done. */
	async publish(message: string): Promise<void> {
		await this.openPublish();

		await expect(this.commitMessageInput).toBeEnabled({ timeout: 60_000 });
		await this.commitMessageInput.fill(message);

		await expect(this.publishButton).toBeEnabled({ timeout: 60_000 });
		await this.publishButton.click();

		await expect(this.publishTab).toBeHidden({ timeout: 120_000 });
	}

	async assertNothingToPublish(): Promise<void> {
		await this.openPublish();
		await expect(this.noChanges).toBeVisible({ timeout: 60_000 });
	}

	/**
	 * Starts a sync without waiting for it to finish.
	 *
	 * For the flows that put a dialog in the middle of the sync and expect the test to answer it:
	 * `runLfsMigrationFlow` awaits the user's choice inside `SyncService._onFinish`, so the sync is
	 * not over — and the spinner does not stop — until that dialog is dismissed. Waiting for
	 * completion first would deadlock against the test that is supposed to dismiss it.
	 */
	async clickSync(): Promise<void> {
		await expect(this.syncTrigger).toBeVisible({ timeout: 60_000 });
		await this.syncTrigger.click();
	}

	/**
	 * Pulls, and pushes back whatever the pull left to push.
	 *
	 * Waiting on the spinner rather than on the outcome is deliberate: a sync ends in three different
	 * places — a page reload on success, a conflict alert, or an error toast — and the only thing all
	 * three share is that the icon stops turning. What happened next is the caller's to assert.
	 *
	 * A conflict does not hold it up: `_onFinish` only opens the conflict modal and returns, so
	 * `finish` fires and the icon stops while the alert is still on screen.
	 */
	async sync(): Promise<void> {
		await this.clickSync();
		await expect(this._syncSpinner()).toHaveCount(0, { timeout: 180_000 });
	}

	/** Moves from the "Failed to synchronize changes" alert into the resolver proper. */
	async openSyncConflictResolver(): Promise<void> {
		await expect(this.syncConflictAlert).toBeVisible({ timeout: 120_000 });
		await this.syncConflictAlert.getByRole("button", { name: "Resolve conflict" }).click();
		await expect(this.conflictResolver).toBeVisible({ timeout: 120_000 });
	}

	/**
	 * Confirms the resolution and waits for the dialog to go.
	 *
	 * The editor inside the dialog is torn down the moment the request starts, so only the dialog
	 * closing means the resolution finished — leaving earlier cancels it mid-flight.
	 */
	async confirmConflictResolution(): Promise<void> {
		await this.conflictResolver.getByRole("button", { name: "Confirm" }).click();
		await expect(this.conflictResolver).toBeHidden({ timeout: 120_000 });
	}

	/** Declines the conflict alert, which is what runs the abort path on the backend. */
	async abortConflict(): Promise<void> {
		await expect(this.syncConflictAlert).toBeVisible({ timeout: 120_000 });
		await this.syncConflictAlert.getByRole("button", { name: "Cancel" }).click();
		await expect(this.syncConflictAlert).toBeHidden({ timeout: 120_000 });
	}

	/** Advanced mode lists article resources as their own rows instead of folding them into the article. */
	async toggleDiffExtendedMode(): Promise<void> {
		await this.publishTab.getByTestId("diff-extended-mode-trigger").click();
		await this._page.getByRole("menuitem", { name: "Advanced mode" }).click();
		await this._page.keyboard.press("Escape");
	}

	/** `animate-spin` is put on the icon while a sync is in flight (`Sync.tsx` via `SyncIconService`). */
	private _syncSpinner(): Locator {
		return this._page.locator(".sync-icons .status-bar-icon.animate-spin");
	}

	private _modal(): Locator {
		return this._page.getByTestId("modal");
	}

	private async _openBranchMenu(name: string): Promise<void> {
		await this.openBranches();

		const item = this.branchItem(name);
		await expect(item).toBeVisible({ timeout: 30_000 });
		// The "..." only fades in while its row is hovered.
		await item.hover();
		await this.branchMenuTrigger(name).click();
	}
}
