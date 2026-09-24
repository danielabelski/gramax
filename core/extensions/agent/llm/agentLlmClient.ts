import type { AgentLlmAdapter } from "./agentLlmAdapter";
import { AgentLlmAdapter as AgentLlmAdapterClass } from "./agentLlmAdapter";
import { AgentLlmChat } from "./agentLlmChat";
import type { AgentLlmEndpoint } from "./agentLlmEndpoint";
import { AgentLlmEventMapper } from "./agentLlmEventMapper";

export class AgentLlmClient {
	readonly adapter: AgentLlmAdapter;
	readonly mapper: AgentLlmEventMapper;
	readonly chat: AgentLlmChat;

	private constructor(adapter: AgentLlmAdapter, mapper: AgentLlmEventMapper, chat: AgentLlmChat) {
		this.adapter = adapter;
		this.mapper = mapper;
		this.chat = chat;
	}

	static create(endpoint: AgentLlmEndpoint): AgentLlmClient {
		return new AgentLlmClient(new AgentLlmAdapterClass(endpoint), new AgentLlmEventMapper(), new AgentLlmChat());
	}
}
