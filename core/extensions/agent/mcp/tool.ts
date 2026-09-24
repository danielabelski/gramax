import type { CommandTree } from "@app/commands";
import type Application from "@app/types/Application";
import type Context from "@core/Context/Context";
import type { AgentLlmClient } from "../llm/agentLlmClient";
import type { ChatCompletionUsage } from "../llm/agentLlmContracts";

export type ToolExecutionResult = {
	ok: boolean;
	data?: unknown;
	error?: string;
	refreshPage?: boolean;
	navChanged?: boolean;
};

export function ok(data: unknown, opts?: { refreshPage?: boolean; navChanged?: boolean }): ToolExecutionResult {
	const refreshPage = opts?.refreshPage ?? false;
	const navChanged = opts?.navChanged ?? refreshPage;
	return { ok: true, data, error: undefined, refreshPage, navChanged };
}

export function fail(error: string, data?: unknown): ToolExecutionResult {
	return { ok: false, error, data };
}

export type ToolExecutionContext = {
	input: unknown;
	app: Application;
	ctx: Context;
	commands: CommandTree;
	sessionId?: string;
	openCatalogName?: string;
	openItemPath?: string;
	llmClient?: AgentLlmClient;
	onUsage?: (usage: ChatCompletionUsage) => void;
};

export type ToolDefinition = {
	name: string;
	description: string;
	inputSchema: {
		type: "object";
		properties?: Record<string, unknown>;
		required?: string[];
		additionalProperties?: boolean;
	};
	execute: (context: ToolExecutionContext) => Promise<ToolExecutionResult>;
};
