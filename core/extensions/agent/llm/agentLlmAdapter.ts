import type { AgentLlmEndpoint } from "./agentLlmEndpoint";

export class AgentLlmAdapter {
	constructor(readonly endpoint: AgentLlmEndpoint) {}

	get url(): string {
		return this.endpoint.url;
	}

	get credentials(): RequestCredentials {
		return this.endpoint.kind === "enterpriseCloud" ? "include" : "same-origin";
	}

	isAuthenticationConfigured(): boolean {
		switch (this.endpoint.kind) {
			case "direct":
				return Boolean(this.endpoint.apiKey) && Boolean(this.endpoint.url);
			case "enterprise":
				return Boolean(this.endpoint.token) && Boolean(this.endpoint.url);
			case "enterpriseCloud":
				return true;
		}
	}

	getHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Accept: "text/event-stream",
		};
		const token = this._getAuthorizationToken();
		if (token) headers.Authorization = `Bearer ${token}`;
		return headers;
	}

	private _getAuthorizationToken(): string | undefined {
		switch (this.endpoint.kind) {
			case "direct":
				return this.endpoint.apiKey;
			case "enterprise":
				return this.endpoint.token;
			case "enterpriseCloud":
				return undefined;
		}
	}
}
