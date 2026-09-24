import { expect } from "@playwright/test";
import { AGENT_TEST_ARTICLE_TITLE, agentTest, agentTestOptions, openAgentChat, openAgentSkills } from "./agent.fixture";

agentTest.use(agentTestOptions);

import { installAgentLlmRouteMock, type PlannedCall, uninstallAgentLlmRouteMock } from "./mocks/llmRouteMock";
import { getFailedToolErrors, getInvokedToolNames, getSuccessfulToolNames } from "./mocks/sessionAssertions";

const CATALOG = "agent-test";
const SKILL_NAME = "E2E Test Skill";
const SKILL_BODY = "E2E skill description.\n\n## Rule\n\nAlways greet.";

const plannedCalls: PlannedCall[] = [
	{ name: "read_catalog_item", args: { catalogName: CATALOG, itemPath: `@skills/${SKILL_NAME}` } },
];

agentTest.beforeEach(async ({ agentPage }) => {
	await installAgentLlmRouteMock(agentPage, plannedCalls);
});

agentTest.afterEach(async ({ agentPage }) => {
	await uninstallAgentLlmRouteMock(agentPage);
});

agentTest("creates skill in UI and agent reads it via read_catalog_item", async ({ agentPage, catalogPage }) => {
	await catalogPage.waitForLoad();
	await expect(agentPage.getByTestId("article-scroll-container")).toBeVisible();

	await openAgentSkills(agentPage);
	await agentPage.getByTestId("create-agent-skill").click();

	const editor = agentPage.locator('[data-qa="article-editor"]');
	await expect(editor).toBeVisible();
	await editor.locator(".ProseMirror p").first().click();
	await agentPage.keyboard.insertText(SKILL_NAME);
	await agentPage.keyboard.press("Enter");
	await agentPage.keyboard.insertText(SKILL_BODY);
	await agentPage.waitForTimeout(600);
	await agentPage.keyboard.press("Escape");
	await agentPage.evaluate(async () => {
		await window.debug?.forceSave?.();
	});

	const skillItem = agentPage.getByTestId("agent-skill-row").filter({ hasText: SKILL_NAME });
	await expect(skillItem).toBeVisible();
	await skillItem.click();
	await expect(editor.locator(".ProseMirror")).toContainText("Always greet");

	await agentPage.locator("[data-qa^='catalog-navigation-']", { hasText: AGENT_TEST_ARTICLE_TITLE }).click();
	await expect(agentPage.getByTestId("article-scroll-container")).toBeVisible();

	await openAgentChat(agentPage);
	const chat = agentPage.locator('[data-floating-panel-id="agent-chat"]');
	await expect(chat).toBeVisible();
	const input = chat.getByRole("textbox");
	await input.fill("read the e2e skill");
	await input.press("Enter");

	await expect
		.poll(async () => getSuccessfulToolNames(agentPage).then((names) => names.includes("read_catalog_item")))
		.toBe(true);

	expect(await getFailedToolErrors(agentPage)).toEqual([]);
	expect(await getInvokedToolNames(agentPage)).toContain("read_catalog_item");
});
