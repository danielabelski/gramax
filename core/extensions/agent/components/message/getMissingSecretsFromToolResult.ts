import type { ToolResultMessage } from "../types/chat";
import { isPlainObject } from "../utils/agentTimeline";

export type MissingSecretWarning = {
	secrets: string[];
};

const MISSING_SECRET_PREFIX = "Missing secret:";

/** Derives a missing-secret warning from `http_request`, `mail_request` or `transcribe_audio` tool result JSON — UI-only,
 *  computed on demand from existing chat data rather than stored as a separate event. */
export const getMissingSecretsFromToolResult = (message: ToolResultMessage): MissingSecretWarning | null => {
	if (
		message.toolName !== "http_request" &&
		message.toolName !== "mail_request" &&
		message.toolName !== "transcribe_audio"
	)
		return null;
	if (!message.toolResultIsError) return null;
	if (!message.toolResultContent) return null;

	let parsed: unknown;
	try {
		parsed = JSON.parse(message.toolResultContent);
	} catch {
		return null;
	}

	if (!isPlainObject(parsed)) return null;
	if (typeof parsed.error !== "string") return null;
	if (!parsed.error.startsWith(MISSING_SECRET_PREFIX)) return null;

	const data = parsed.data;
	if (!isPlainObject(data)) return null;
	if (!Array.isArray(data.secrets)) return null;

	const secrets = data.secrets.filter((secret): secret is string => typeof secret === "string" && secret.length > 0);
	if (secrets.length === 0) return null;

	return { secrets };
};
