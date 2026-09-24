import { AgentLlmAdapter } from "./agentLlmAdapter";

describe("AgentLlmAdapter", () => {
	it("configures direct endpoint", () => {
		const adapter = new AgentLlmAdapter({
			kind: "direct",
			url: "https://direct.example.com",
			apiKey: "direct-key",
		});

		expect({
			url: adapter.url,
			credentials: adapter.credentials,
			isAuthenticationConfigured: adapter.isAuthenticationConfigured(),
			headers: adapter.getHeaders(),
		}).toEqual({
			url: "https://direct.example.com",
			credentials: "same-origin",
			isAuthenticationConfigured: true,
			headers: {
				Accept: "text/event-stream",
				Authorization: "Bearer direct-key",
				"Content-Type": "application/json",
			},
		});
	});

	it("configures enterprise endpoint", () => {
		const adapter = new AgentLlmAdapter({
			kind: "enterprise",
			url: "https://enterprise.example.com",
			token: "enterprise-token",
		});

		expect({
			url: adapter.url,
			credentials: adapter.credentials,
			isAuthenticationConfigured: adapter.isAuthenticationConfigured(),
			headers: adapter.getHeaders(),
		}).toEqual({
			url: "https://enterprise.example.com",
			credentials: "same-origin",
			isAuthenticationConfigured: true,
			headers: {
				Accept: "text/event-stream",
				Authorization: "Bearer enterprise-token",
				"Content-Type": "application/json",
			},
		});
	});

	it("configures enterprise cloud endpoint", () => {
		const adapter = new AgentLlmAdapter({ kind: "enterpriseCloud", url: "https://cloud.example.com" });

		expect({
			url: adapter.url,
			credentials: adapter.credentials,
			isAuthenticationConfigured: adapter.isAuthenticationConfigured(),
			headers: adapter.getHeaders(),
		}).toEqual({
			url: "https://cloud.example.com",
			credentials: "include",
			isAuthenticationConfigured: true,
			headers: {
				Accept: "text/event-stream",
				"Content-Type": "application/json",
			},
		});
	});

	it.each([
		{ kind: "direct" as const, url: "https://direct.example.com", apiKey: "" },
		{ kind: "enterprise" as const, url: "https://enterprise.example.com", token: "" },
	])("reports missing authentication for $kind endpoint", (endpoint) => {
		const adapter = new AgentLlmAdapter(endpoint);

		expect(adapter.isAuthenticationConfigured()).toBe(false);
	});
});
