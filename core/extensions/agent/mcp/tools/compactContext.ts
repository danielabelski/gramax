import { agentConfig } from "../../core/agentConfig";
import { ContextCompactor } from "../../core/compaction";
import { fail, ok, type ToolExecutionContext, type ToolExecutionResult } from "../tool";

export async function runCompactContext(context: ToolExecutionContext): Promise<ToolExecutionResult> {
	const { app, ctx, commands, sessionId, llmClient, openCatalogName, onUsage } = context;
	const session = sessionId ? app.agentManager.sessions.get(sessionId) : null;
	if (!session) return fail("compact_context: session not found");
	if (!llmClient) return fail("compact_context: missing execution context");

	try {
		const messages = await llmClient.mapper.eventsToMessages(app, ctx, commands, session.events, openCatalogName);
		const compactor = new ContextCompactor(llmClient, agentConfig.compactionTailUserCharsBudget);
		const { summary, tailUserMessages } = await compactor.compact(session.events, messages, onUsage);
		return ok({ summary, tailUserMessages });
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return fail(`Failed to compact context: ${msg}`);
	}
}
