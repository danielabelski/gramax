import type { ToolResultMessage } from "../types/chat";
import { getMissingSecretsFromToolResult } from "./getMissingSecretsFromToolResult";

const baseToolResult: ToolResultMessage = {
	id: "t1",
	kind: "tool_result",
	toolName: "http_request",
	toolCallId: "call-1",
	toolResultIsError: true,
	toolResultTs: 1,
	toolResultContentPreview: "",
	toolResultFullLength: 0,
};

describe("getMissingSecretsFromToolResult", () => {
	test("extracts the missing secrets from a well-formed JSON tool result", () => {
		const message: ToolResultMessage = {
			...baseToolResult,
			toolResultContent: JSON.stringify({
				error: "Missing secret: Ютрек.token",
				data: { secrets: ["Ютрек.token"] },
			}),
		};

		expect(getMissingSecretsFromToolResult(message)).toEqual({ secrets: ["Ютрек.token"] });
	});

	test("extracts multiple missing secrets", () => {
		const message: ToolResultMessage = {
			...baseToolResult,
			toolResultContent: JSON.stringify({
				error: "Missing secret: A.token, B.login",
				data: { secrets: ["A.token", "B.login"] },
			}),
		};

		expect(getMissingSecretsFromToolResult(message)).toEqual({ secrets: ["A.token", "B.login"] });
	});

	test("extracts missing secrets from a mail_request tool result", () => {
		const message: ToolResultMessage = {
			...baseToolResult,
			toolName: "mail_request",
			toolResultContent: JSON.stringify({
				error: "Missing secret: Mail.url",
				data: { secrets: ["Mail.url"] },
			}),
		};

		expect(getMissingSecretsFromToolResult(message)).toEqual({ secrets: ["Mail.url"] });
	});

	test("returns null for a successful tool result", () => {
		const message: ToolResultMessage = {
			...baseToolResult,
			toolResultIsError: false,
			toolResultContent: JSON.stringify({ status: 200 }),
		};

		expect(getMissingSecretsFromToolResult(message)).toBeNull();
	});

	test("returns null for an error unrelated to missing secrets", () => {
		const message: ToolResultMessage = {
			...baseToolResult,
			toolResultContent: JSON.stringify({ error: "Network timeout" }),
		};

		expect(getMissingSecretsFromToolResult(message)).toBeNull();
	});

	test("returns null for invalid JSON content", () => {
		const message: ToolResultMessage = { ...baseToolResult, toolResultContent: "not json {{{" };
		expect(getMissingSecretsFromToolResult(message)).toBeNull();
	});

	test("returns null when there is no tool result content at all", () => {
		expect(getMissingSecretsFromToolResult(baseToolResult)).toBeNull();
	});

	test("extracts the missing secret from a transcribe_audio tool result", () => {
		const message: ToolResultMessage = {
			...baseToolResult,
			toolName: "transcribe_audio",
			toolResultContent: JSON.stringify({
				error: "Missing secret: NEXARA_API_KEY",
				data: { secrets: ["NEXARA_API_KEY"] },
			}),
		};

		expect(getMissingSecretsFromToolResult(message)).toEqual({ secrets: ["NEXARA_API_KEY"] });
	});

	test("returns null for a tool other than http_request, even with a missing-secret-shaped error", () => {
		const message: ToolResultMessage = {
			...baseToolResult,
			toolName: "read_file",
			toolResultContent: JSON.stringify({ error: "Missing secret: X.token", data: { secrets: ["X.token"] } }),
		};

		expect(getMissingSecretsFromToolResult(message)).toBeNull();
	});

	test("returns null when data.secrets is missing, empty, or not a string array", () => {
		const noSecrets: ToolResultMessage = {
			...baseToolResult,
			toolResultContent: JSON.stringify({ error: "Missing secret: X.token" }),
		};
		const emptySecrets: ToolResultMessage = {
			...baseToolResult,
			toolResultContent: JSON.stringify({ error: "Missing secret: X.token", data: { secrets: [] } }),
		};
		const nonArraySecrets: ToolResultMessage = {
			...baseToolResult,
			toolResultContent: JSON.stringify({ error: "Missing secret: X.token", data: { secrets: "X.token" } }),
		};

		expect(getMissingSecretsFromToolResult(noSecrets)).toBeNull();
		expect(getMissingSecretsFromToolResult(emptySecrets)).toBeNull();
		expect(getMissingSecretsFromToolResult(nonArraySecrets)).toBeNull();
	});
});
