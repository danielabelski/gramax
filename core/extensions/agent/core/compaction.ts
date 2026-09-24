import type { AgentLlmClient } from "../llm/agentLlmClient";
import type { ChatCompletionMessage, ChatCompletionUsage } from "../llm/agentLlmContracts";
import { COMPACTION_PROMPT_MAP } from "../prompts/compactionPromptMap";
import type { AgentEvent } from "./events";

export type CompactionResult = {
	summary: string;
	tailUserMessages: Extract<AgentEvent, { type: "user_message" }>[];
};

export class ContextCompactor {
	constructor(
		private readonly _llmClient: AgentLlmClient,
		private readonly _tailUserCharsBudget: number,
	) {}

	async compact(
		events: AgentEvent[],
		messages: ChatCompletionMessage[],
		onUsage?: (usage: ChatCompletionUsage) => void,
	): Promise<CompactionResult> {
		const summaryMessages = this._appendSummaryRequest(messages);
		const result = await this._llmClient.chat.streamIteration(
			this._llmClient.adapter,
			summaryMessages,
			undefined,
			() => {},
			undefined,
			onUsage,
		);
		const summary = result.content?.trim() ?? "";
		return {
			summary: `${COMPACTION_PROMPT_MAP.handoffPrefix}\n\n${summary}`,
			tailUserMessages: this._selectTailUserMessages(events),
		};
	}

	private _appendSummaryRequest(messages: ChatCompletionMessage[]): ChatCompletionMessage[] {
		const last = messages[messages.length - 1];
		if (last?.role === "user" && typeof last.content === "string") {
			const merged: ChatCompletionMessage = {
				...last,
				content: `${last.content}\n\n${COMPACTION_PROMPT_MAP.summaryRequest}`,
			};
			return [...messages.slice(0, -1), merged];
		}
		return [...messages, { role: "user", content: COMPACTION_PROMPT_MAP.summaryRequest }];
	}

	private _selectTailUserMessages(events: AgentEvent[]): Extract<AgentEvent, { type: "user_message" }>[] {
		const userMessages = events.filter(
			(e): e is Extract<AgentEvent, { type: "user_message" }> => e.type === "user_message",
		);
		const tail: Extract<AgentEvent, { type: "user_message" }>[] = [];
		let total = 0;
		for (let i = userMessages.length - 1; i >= 0; i--) {
			const len = userMessages[i].content.length;
			if (total + len > this._tailUserCharsBudget && tail.length > 0) break;
			tail.unshift(userMessages[i]);
			total += len;
		}
		return tail;
	}
}
