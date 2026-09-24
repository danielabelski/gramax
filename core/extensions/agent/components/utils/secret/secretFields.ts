import type { AgentSecret } from "@ext/agent/mcp/agentSecretStore";
import type { SecretField } from "@ext/markdown/elements/secret/edit/logic/secretFields";

/** Fields exposed per secret kind — login/password, token, and optional url on both. */
export const SECRET_FIELDS_BY_KIND: Record<AgentSecret["type"], SecretField[]> = {
	login: ["login", "password", "url"],
	token: ["token", "url"],
};
