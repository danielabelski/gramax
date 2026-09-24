export type AgentLlmEndpoint =
	| { kind: "direct"; url: string; apiKey: string }
	| { kind: "enterprise"; url: string; token: string }
	| { kind: "enterpriseCloud"; url: string };

export const parseAgentLlmEndpoint = (value: unknown): AgentLlmEndpoint => {
	if (!value || typeof value !== "object") throw new Error("Invalid agent LLM endpoint");

	const endpoint = value as Record<string, unknown>;
	if (typeof endpoint.url !== "string") throw new Error("Invalid agent LLM endpoint URL");

	switch (endpoint.kind) {
		case "direct":
			if (typeof endpoint.apiKey !== "string") throw new Error("Invalid direct agent LLM API key");
			return { kind: endpoint.kind, url: endpoint.url, apiKey: endpoint.apiKey };
		case "enterprise":
			if (typeof endpoint.token !== "string") throw new Error("Invalid enterprise agent LLM token");
			return { kind: endpoint.kind, url: endpoint.url, token: endpoint.token };
		case "enterpriseCloud":
			return { kind: endpoint.kind, url: endpoint.url };
		default:
			throw new Error("Invalid agent LLM endpoint kind");
	}
};
