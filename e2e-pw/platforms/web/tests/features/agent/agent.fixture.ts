import type { Page } from "@playwright/test";
import { catalogTest } from "@web/fixtures/catalog.fixture";

const E2E_API_KEY = "e2e-api-key";
const E2E_AI_URL = "https://e2e-ai.local";

export const AGENT_TEST_ARTICLE_TITLE = "Test Article";

/** The chat toggle only renders in GES and GES Cloud, so tests open the panel through the store. */
export const openAgentChat = async (page: Page): Promise<void> => {
	await page.evaluate(() => window.debug.agentChat(true));
};

/** The catalog menu hides the skills entry outside GES and GES Cloud, so tests open the tab directly. */
export const openAgentSkills = async (page: Page): Promise<void> => {
	await page.evaluate(() => window.debug.agentSkills(true));
};

export type AgentFixture = {
	agentPage: Page;
};

async function prepareAgentTest(page: Page): Promise<string> {
	return page.evaluate(
		async ({ apiUrl, token }) => {
			const commands = await window.debug.commands();
			await commands.agent.session.restore.do({ activeSessionId: null });
			const { id: sessionId } = await commands.agent.session.create.do({});
			await window.debug.setWorkspaceAi(apiUrl, token);
			localStorage.setItem(
				"agent-state",
				JSON.stringify({
					state: { activeSessionId: sessionId, sessions: [] },
					version: 0,
				}),
			);
			await commands.agent.session.restore.do({ activeSessionId: sessionId });
			return sessionId;
		},
		{ apiUrl: E2E_AI_URL, token: E2E_API_KEY },
	);
}

async function cleanupAgentTest(page: Page, sessionId: string) {
	await page.evaluate(async (sessionId) => {
		const commands = await window.debug.commands();
		await commands.agent.session.delete.do({ sessionId });
	}, sessionId);
}

export const agentTest = catalogTest.extend<AgentFixture>({
	agentPage: async ({ sharedPage, catalogPage }, use) => {
		const sessionId = await prepareAgentTest(sharedPage);
		await sharedPage.reload({ waitUntil: "domcontentloaded" });
		await catalogPage.waitForLoad();

		await use(sharedPage);

		await cleanupAgentTest(sharedPage, sessionId);
	},
});

export const agentTestOptions = {
	startUrl: "/-/-/-/-/agent-test/test-article",
	files: {
		"agent-test": {
			"doc-root.yml": "title: Agent Test\nsyntax: xml\n",
			"test-article.md": "---\ntitle: Test Article\n---\n\n# Hello\n\nOriginal body",
			"target-cat/_index.md": "---\ntitle: Target Cat\n---\n",
		},
	},
};
