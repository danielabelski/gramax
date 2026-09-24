import type { ToolPreview } from "../mcp/toolPreview";
import type { AgentErrorType, AgentWarningType } from "./agentError";
import type { AgentAttachment } from "./attachmentStore";

export type AgentTurnStatus = "completed" | "failed" | "cancelled";

export type AgentQuote = { catalogName?: string; itemPath?: string; text: string };

export type AgentEvent =
	| {
			type: "user_message";
			turnId: string;
			ts: number;
			content: string;
			browserAllowed?: boolean;
			attachments?: AgentAttachment[];
			quote?: AgentQuote;
			useSkill?: string;
			openCatalogName?: string;
			openItemPath?: string;
	  }
	| {
			type: "context_compacted";
			turnId: string;
			ts: number;
			summary: string;
			tailUserMessages: Extract<AgentEvent, { type: "user_message" }>[];
	  }
	| { type: "assistant_delta"; turnId: string; ts: number; content: string }
	| {
			type: "assistant_message";
			turnId: string;
			ts: number;
			content: string;
			contentPreview: string;
			reasoningContent?: string;
	  }
	| {
			type: "tool_call_requested";
			turnId: string;
			ts: number;
			toolCallId: string;
			name: string;
			arguments: unknown;
			preview?: ToolPreview;
	  }
	| {
			type: "tool_result";
			turnId: string;
			ts: number;
			toolCallId: string;
			name: string;
			content?: string;
			contentPreview: string;
			fullLength: number;
			isError: boolean;
			refreshPage?: boolean;
			catalogMutated?: boolean;
	  }
	| {
			type: "tool_awaiting_confirmation";
			turnId: string;
			ts: number;
			correlationId: string;
			toolCallId: string;
			name: string;
			summary: string;
	  }
	| {
			type: "turn_finished";
			turnId: string;
			ts: number;
			status: AgentTurnStatus;
			refreshPage?: boolean;
	  }
	| { type: "warning"; turnId: string; ts: number; message: string; warningType: AgentWarningType }
	| { type: "error"; turnId: string; ts: number; message: string; errorType: AgentErrorType };
