import { useAgentSecretDraftStore } from "@ext/agent/components/store/AgentSecretDraftStore";
import t from "@ext/localization/locale/translate";
import { fireEvent, render } from "@testing-library/react";
import { webcrypto } from "crypto";
import { createElement } from "react";
import type { ChatMessage } from "../types/chat";
import type { Section } from "./SectionBlock";
import { SectionBlock } from "./SectionBlock";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

jest.mock("./ThinkingCollapsible", () => ({
	ThinkingCollapsible: ({
		children,
		durationMs,
		startedAt,
	}: {
		children: React.ReactNode;
		durationMs?: number;
		startedAt: number;
	}) =>
		require("react").createElement(
			"div",
			{
				"data-duration-ms": durationMs,
				"data-started-at": startedAt,
				"data-testid": "thinking-collapsible",
			},
			children,
		),
}));

jest.mock("./ToolActivityBundle", () => ({
	ToolActivityBundle: () => require("react").createElement("div", { "data-testid": "tool-activity" }),
}));

jest.mock("./AssistantMarkdown", () => ({
	AssistantMarkdown: ({ text }: { text: string }) =>
		require("react").createElement("div", { "data-testid": "markdown" }, text),
}));

jest.mock("./CopyAnswerButton", () => ({
	CopyAnswerButton: () => require("react").createElement("button", { "data-testid": "copy-button", type: "button" }),
}));

jest.mock("./MessageCard/UserMessage", () => ({
	UserMessage: ({ userText }: { userText: string }) =>
		require("react").createElement("div", { "data-testid": "user" }, userText),
}));

const mockOpenAgentSecretsSettings = jest.fn();
jest.mock("@ext/agent/components/utils/openAgentSecretsSettings", () => ({
	openAgentSecretsSettings: () => mockOpenAgentSecretsSettings(),
}));

const user: ChatMessage = { id: "u1", kind: "user", userText: "call the youtrack api", ts: 1 };

const toolCall: ChatMessage = {
	id: "t1",
	kind: "tool_call",
	toolName: "http_request",
	toolCallId: "call-1",
	toolArguments: {},
};

const missingSecretToolResult: ChatMessage = {
	id: "t2",
	kind: "tool_result",
	toolName: "http_request",
	toolCallId: "call-1",
	toolResultIsError: true,
	toolResultTs: 2,
	toolResultContent: JSON.stringify({ error: "Missing secret: Ютрек.token", data: { secrets: ["Ютрек.token"] } }),
	toolResultContentPreview: "Missing secret: Ютрек.token",
	toolResultFullLength: 60,
};

const assistantAnswer: ChatMessage = {
	id: "a1",
	kind: "assistant",
	description: "Here is the answer.",
	ts: 4,
};

const turnDuration: ChatMessage = { id: "d1", kind: "turn_duration", ts: 5 };

const cancelledMessage: ChatMessage = { id: "c1", kind: "cancelled", ts: 3 };

const section: Section = {
	user,
	responses: [toolCall, missingSecretToolResult, assistantAnswer, turnDuration],
};

const renderSection = (isLast: boolean) =>
	render(
		createElement(SectionBlock, {
			section,
			isLast,
			streamingMessageId: null,
			showThinking: false,
		}),
	);

describe("SectionBlock — missing-secret warning placement", () => {
	beforeEach(() => {
		mockOpenAgentSecretsSettings.mockClear();
		useAgentSecretDraftStore.getState().consumePendingDrafts();
	});

	test("attaches the warning after the final assistant answer and before the copy button, when this is the last section", () => {
		const { container, getByText } = renderSection(true);

		const markdown = container.querySelector('[data-testid="markdown"]');
		const addTokenButton = getByText(t("agent.missing-secret.button"));
		const copyButton = container.querySelector('[data-testid="copy-button"]');

		expect(markdown).not.toBeNull();
		expect(copyButton).not.toBeNull();

		expect(
			markdown && (markdown.compareDocumentPosition(addTokenButton) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
		).toBe(true);
		expect(
			addTokenButton &&
				copyButton &&
				(addTokenButton.compareDocumentPosition(copyButton) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
		).toBe(true);
	});

	test("renders the warning exactly once, not duplicated as a standalone status message or hidden inside the collapsed thinking block", () => {
		const { queryAllByText } = renderSection(true);

		expect(queryAllByText(t("agent.missing-secret.button"))).toHaveLength(1);
		const collapsible = document.querySelector('[data-testid="thinking-collapsible"]');
		expect(collapsible?.textContent?.includes(t("agent.missing-secret.button"))).toBeFalsy();
	});

	test("does not render the warning when this section is no longer the last one", () => {
		const { queryByText } = renderSection(false);
		expect(queryByText(t("agent.missing-secret.button"))).toBeNull();
	});

	test("does not render a warning for a normal (non-missing-secret) tool error", () => {
		const otherErrorSection: Section = {
			user,
			responses: [
				toolCall,
				{
					...missingSecretToolResult,
					toolResultContent: JSON.stringify({ error: "Network timeout" }),
					toolResultContentPreview: "Network timeout",
				},
				assistantAnswer,
				turnDuration,
			],
		};

		const { queryByText } = render(
			createElement(SectionBlock, {
				section: otherErrorSection,
				isLast: true,
				streamingMessageId: null,
				showThinking: false,
			}),
		);

		expect(queryByText(t("agent.missing-secret.button"))).toBeNull();
	});

	test("renders the warning even when the turn was cancelled before any assistant reply", () => {
		const cancelledSection: Section = {
			user,
			responses: [toolCall, missingSecretToolResult, cancelledMessage, turnDuration],
		};

		const { container, getByText } = render(
			createElement(SectionBlock, {
				section: cancelledSection,
				isLast: true,
				streamingMessageId: null,
				showThinking: false,
			}),
		);

		const addTokenButton = getByText(t("agent.missing-secret.button"));
		const toolActivity = container.querySelector('[data-testid="tool-activity"]');

		expect(addTokenButton).not.toBeNull();
		expect(toolActivity).not.toBeNull();
		expect(
			toolActivity &&
				(toolActivity.compareDocumentPosition(addTokenButton) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
		).toBe(true);
	});

	test("renders the warning after the cancelled status when an assistant reply already exists", () => {
		const cancelledAfterAssistantSection: Section = {
			user,
			responses: [toolCall, missingSecretToolResult, assistantAnswer, cancelledMessage, turnDuration],
		};

		const { getByText } = render(
			createElement(SectionBlock, {
				section: cancelledAfterAssistantSection,
				isLast: true,
				streamingMessageId: null,
				showThinking: false,
			}),
		);

		const cancelled = getByText((content) => content.startsWith(t("agent.stopped-after")));
		const addTokenButton = getByText(t("agent.missing-secret.button"));

		expect(cancelled.compareDocumentPosition(addTokenButton) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
	});

	test("renders the warning at section end when the last non-empty assistant is inside thinking details", () => {
		const assistantInsideThinking: ChatMessage = {
			id: "a2",
			kind: "assistant",
			description: "I need the login.",
			ts: 4,
		};
		const emptyFinalAssistant: ChatMessage = {
			id: "a3",
			kind: "assistant",
			description: "",
			ts: 5,
		};
		const sectionWithHiddenAnchor: Section = {
			user,
			responses: [
				assistantAnswer,
				toolCall,
				missingSecretToolResult,
				assistantInsideThinking,
				emptyFinalAssistant,
				turnDuration,
			],
		};

		const { container, getByText } = render(
			createElement(SectionBlock, {
				section: sectionWithHiddenAnchor,
				isLast: true,
				streamingMessageId: null,
				showThinking: false,
			}),
		);

		const collapsible = container.querySelector('[data-testid="thinking-collapsible"]');
		const addTokenButton = getByText(t("agent.missing-secret.button"));

		expect(collapsible).not.toBeNull();
		expect(collapsible?.textContent?.includes(t("agent.missing-secret.button"))).toBeFalsy();
		expect(
			collapsible &&
				(collapsible.compareDocumentPosition(addTokenButton) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
		).toBe(true);
	});

	test("clicking 'Add token' sets the pending draft and opens the keys-and-passwords settings", () => {
		const { getByText } = renderSection(true);

		fireEvent.click(getByText(t("agent.missing-secret.button")));

		expect(useAgentSecretDraftStore.getState().pendingDrafts).toMatchObject([
			{ key: "Ютрек", kind: "token", focus: "value" },
		]);
		expect(mockOpenAgentSecretsSettings).toHaveBeenCalledTimes(1);
	});
});

describe("SectionBlock thinking indicator", () => {
	test("shows the thinking indicator after tool messages when a turn has no assistant text yet", () => {
		const toolPhaseSection: Section = {
			user,
			responses: [toolCall, { ...missingSecretToolResult, toolResultIsError: false }],
		};

		const { container, getByText } = render(
			createElement(SectionBlock, {
				section: toolPhaseSection,
				isLast: true,
				streamingMessageId: null,
				showThinking: true,
			}),
		);

		const toolActivity = container.querySelector('[data-testid="tool-activity"]');
		const indicator = getByText(t("agent.thinking"));

		expect(toolActivity).not.toBeNull();
		expect(toolActivity?.compareDocumentPosition(indicator) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
	});

	test("measures active work from the first agent response timestamp, not from the user message", () => {
		const timedSection: Section = {
			user: { ...user, ts: 1_000 },
			responses: [
				{ ...assistantAnswer, ts: 5_000 },
				{ ...toolCall, ts: 6_000 },
				{ ...missingSecretToolResult, ts: 9_000 },
			],
		};

		const { container } = render(
			createElement(SectionBlock, {
				section: timedSection,
				isLast: true,
				streamingMessageId: null,
				showThinking: true,
			}),
		);

		const collapsible = container.querySelector('[data-testid="thinking-collapsible"]');
		expect(collapsible?.getAttribute("data-started-at")).toBe("5000");
	});

	test("measures finished work from the first agent response timestamp, not from the user message", () => {
		const timedSection: Section = {
			user: { ...user, ts: 1_000 },
			responses: [
				{ ...assistantAnswer, ts: 5_000 },
				{ ...toolCall, ts: 6_000 },
				{ ...turnDuration, ts: 9_000 },
			],
		};

		const { container } = render(
			createElement(SectionBlock, {
				section: timedSection,
				isLast: true,
				streamingMessageId: null,
				showThinking: false,
			}),
		);

		const collapsible = container.querySelector('[data-testid="thinking-collapsible"]');
		expect(collapsible?.getAttribute("data-duration-ms")).toBe("4000");
	});

	test("keeps the same start reference for the live counter and the final duration, so there is no jump when the turn finishes", () => {
		const responses: ChatMessage[] = [
			{ ...toolCall, id: "tc1", ts: 5_000 },
			{ ...assistantAnswer, ts: 8_000 },
			{ ...toolCall, id: "tc2", ts: 12_000 },
		];

		const { container, rerender } = render(
			createElement(SectionBlock, {
				section: { user: { ...user, ts: 1_000 }, responses },
				isLast: true,
				streamingMessageId: null,
				showThinking: true,
			}),
		);

		const liveCollapsible = container.querySelector('[data-testid="thinking-collapsible"]');
		const startedAt = liveCollapsible?.getAttribute("data-started-at");
		expect(startedAt).toBe("5000");

		rerender(
			createElement(SectionBlock, {
				section: {
					user: { ...user, ts: 1_000 },
					responses: [...responses, { ...turnDuration, ts: 20_000 }],
				},
				isLast: true,
				streamingMessageId: null,
				showThinking: false,
			}),
		);

		const finishedCollapsible = container.querySelector('[data-testid="thinking-collapsible"]');
		expect(finishedCollapsible?.getAttribute("data-started-at")).toBe(startedAt);
		expect(finishedCollapsible?.getAttribute("data-duration-ms")).toBe(String(20_000 - Number(startedAt)));
	});
});
