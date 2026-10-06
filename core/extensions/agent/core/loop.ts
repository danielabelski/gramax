import type { CommandTree } from "@app/commands";
import type Application from "@app/types/Application";
import type Context from "@core/Context/Context";
import type { AgentLlmClient, ChatCompletionToolCall, ChatCompletionUsage } from "../llm";
import { agentLlmConfig } from "../llm";
import { LinkAdapter } from "../mcp/parser/adapters/linkAdapter";
import { buildToolPreview } from "../mcp/toolPreview";
import { agentConfig } from "./agentConfig";
import { AgentErrorType } from "./agentError";
import type { AgentEvent } from "./events";

export type AgentLoopCallbacks = {
	onEvent: (e: AgentEvent) => void;
};

export async function runAgentTurn(options: {
	turnId: string;
	sessionId: string;
	app: Application;
	ctx: Context;
	commands: CommandTree;
	llmClient: AgentLlmClient;
	events: AgentEvent[];
	callbacks: AgentLoopCallbacks;
	onLlmUsage?: (usage: ChatCompletionUsage) => void;
	signal?: AbortSignal;
}): Promise<void> {
	const { turnId, sessionId, app, ctx, commands, llmClient, events, callbacks, onLlmUsage, signal } = options;
	const maxSteps = agentConfig.maxSteps;
	const previewMax = agentConfig.toolPreviewMaxChars;
	const push = (e: AgentEvent) => callbacks.onEvent(e);
	const toolRegistry = app.agentManager.toolRegistry;
	const session = app.agentManager.sessions.get(sessionId);
	const catalogName = session?.openCatalogName ?? undefined;

	const tools = llmClient.mapper.toolsToLlmFormat(toolRegistry.getTools(app));
	const compactionTriggerTokens = (agentLlmConfig.contextWindowTokens * agentConfig.compactionTriggerPercent) / 100;

	for (let step = 0; maxSteps === null || step < maxSteps; step++) {
		const overThreshold = !!session && session.usage.contextTokensUsed >= compactionTriggerTokens;
		if (overThreshold) {
			await executeOneToolCall({
				tc: {
					id: `compact-${globalThis.crypto.randomUUID()}`,
					type: "function",
					function: { name: "compact_context", arguments: "{}" },
				},
				turnId,
				app,
				ctx,
				commands,
				sessionId,
				llmClient,
				push,
				previewMax,
				onLlmUsage,
				signal,
			});
		}

		const messages = await llmClient.mapper.eventsToMessages(app, ctx, commands, events, catalogName);
		const streamed = await llmClient.chat.streamIteration(
			llmClient.adapter,
			messages,
			tools.length ? tools : undefined,
			(piece) => push({ type: "assistant_delta", turnId, ts: Date.now(), content: piece }),
			signal,
			onLlmUsage,
		);

		const toolCalls = streamed.tool_calls;
		const textOut = typeof streamed.content === "string" ? streamed.content : "";

		if (!toolCalls?.length && streamed.content == null) {
			push({
				type: "error",
				turnId,
				ts: Date.now(),
				message: "Empty response from model",
				errorType: AgentErrorType.Unexpected,
			});
			return;
		}

		if (textOut || streamed.reasoning_content) {
			const contentPreview = await LinkAdapter.toChat(textOut, app.wm).catch(() => textOut);
			push({
				type: "assistant_message",
				turnId,
				ts: Date.now(),
				content: textOut,
				contentPreview,
				reasoningContent: streamed.reasoning_content ?? undefined,
			});
		}

		if (toolCalls?.length) {
			for (const tc of toolCalls) {
				await executeOneToolCall({
					tc,
					turnId,
					app,
					ctx,
					commands,
					sessionId,
					llmClient,
					push,
					previewMax,
					onLlmUsage,
					signal,
				});
			}
			continue;
		}

		return;
	}

	push({
		type: "error",
		turnId,
		ts: Date.now(),
		message: `Agent step limit exceeded (${maxSteps})`,
		errorType: AgentErrorType.MaxStepsExceeded,
	});
}

async function executeOneToolCall(options: {
	tc: ChatCompletionToolCall;
	turnId: string;
	app: Application;
	ctx: Context;
	commands: CommandTree;
	sessionId: string;
	llmClient: AgentLlmClient;
	push: (e: AgentEvent) => void;
	previewMax: number;
	onLlmUsage?: (usage: ChatCompletionUsage) => void;
	signal?: AbortSignal;
}): Promise<void> {
	const { tc, turnId, app, ctx, commands, sessionId, llmClient, push, previewMax, onLlmUsage, signal } = options;
	const toolRegistry = app.agentManager.toolRegistry;
	const name = tc.function.name;
	const argumentsText = tc.function.arguments ?? "{}";
	let args: unknown;
	try {
		args = argumentsText ? JSON.parse(argumentsText) : {};
	} catch {
		args = { raw: argumentsText };
	}
	const preview = await buildToolPreview(args, app, ctx);

	push({
		type: "tool_call_requested",
		turnId,
		ts: Date.now(),
		toolCallId: tc.id,
		name,
		arguments: args,
		preview,
	});

	const decision = await toolRegistry.policy.beforeToolCall({
		sessionId,
		toolName: name,
		args,
	});

	if (decision.decision === "pending_approval") {
		push({
			type: "tool_awaiting_confirmation",
			turnId,
			ts: Date.now(),
			correlationId: decision.correlationId,
			toolCallId: tc.id,
			name,
			summary: decision.summary,
		});
		push({
			type: "error",
			turnId,
			ts: Date.now(),
			message: "Tool confirmation is not implemented",
			errorType: AgentErrorType.Unexpected,
		});
		return;
	}

	let toolResult: Awaited<ReturnType<typeof toolRegistry.executeTool>>;
	try {
		toolResult = await toolRegistry.executeTool(
			name,
			args,
			app,
			ctx,
			commands,
			sessionId,
			llmClient,
			onLlmUsage,
			signal,
		);
	} catch (e) {
		if (e instanceof DOMException && e.name === "AbortError") {
			const text = "cancelled by user; tool may have completed";
			push({
				type: "tool_result",
				turnId,
				ts: Date.now(),
				toolCallId: tc.id,
				name,
				content: text,
				contentPreview: text,
				fullLength: text.length,
				isError: true,
			});
		}
		throw e;
	}
	let text: string;
	if (toolResult.ok) {
		text = JSON.stringify(toolResult.data ?? null, null, 2);
	} else if (toolResult.data !== undefined) {
		text = JSON.stringify({ error: toolResult.error, data: toolResult.data }, null, 2);
	} else {
		text = toolResult.error ?? "";
	}
	const contentPreview =
		text.length <= previewMax ? text : `${text.slice(0, previewMax)}… [truncated, ${text.length} characters total]`;
	const shouldRefreshPage = toolResult.ok && toolResult.refreshPage === true;
	const catalogMutated = toolResult.ok && toolResult.navChanged === true;

	push({
		type: "tool_result",
		turnId,
		ts: Date.now(),
		toolCallId: tc.id,
		name,
		content: text,
		contentPreview,
		fullLength: text.length,
		isError: !toolResult.ok,
		refreshPage: shouldRefreshPage,
		catalogMutated,
	});

	if (name === "compact_context" && toolResult.ok) {
		const data = toolResult.data as {
			summary: string;
			tailUserMessages: Extract<AgentEvent, { type: "user_message" }>[];
		};
		push({
			type: "context_compacted",
			turnId,
			ts: Date.now(),
			summary: data.summary,
			tailUserMessages: data.tailUserMessages,
		});
	}
}
