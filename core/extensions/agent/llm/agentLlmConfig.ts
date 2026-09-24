export class AgentLlmConfig {
	model = "deepseek-v4-pro";
	temperature = 0.5;
	contextWindowTokens = 250_000;
}

export const agentLlmConfig = new AgentLlmConfig();
