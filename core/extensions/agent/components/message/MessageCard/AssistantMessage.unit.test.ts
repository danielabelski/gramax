import { render } from "@testing-library/react";
import { createElement } from "react";
import type { AssistantChatMessage } from "../../types/chat";
import type { MissingSecretWarning as MissingSecretWarningViewModel } from "../getMissingSecretsFromToolResult";
import { AssistantMessage } from "./AssistantMessage";

jest.mock("../../store/ChatStore", () => ({
	useChatStreamText: () => "",
}));

jest.mock("../AssistantMarkdown", () => ({
	AssistantMarkdown: ({ text }: { text: string }) =>
		require("react").createElement("div", { "data-testid": "markdown" }, text),
}));

jest.mock("../CopyAnswerButton", () => ({
	CopyAnswerButton: ({ text }: { text: string }) =>
		require("react").createElement("button", { "data-testid": "copy-button", type: "button" }, text),
}));

jest.mock("./MissingSecretWarning", () => ({
	MissingSecretWarning: ({ warning }: { warning: MissingSecretWarningViewModel }) =>
		require("react").createElement("div", { "data-testid": "warning" }, warning.secrets.join(", ")),
}));

const baseMessage: AssistantChatMessage = {
	id: "a1",
	kind: "assistant",
	description: "Agent's answer text",
};

const warning: MissingSecretWarningViewModel = { secrets: ["Ютрек.token"] };

describe("AssistantMessage — missing-secret warning", () => {
	test("renders markdown, then the warning, then the copy button, in that DOM order", () => {
		const { container } = render(
			createElement(AssistantMessage, {
				message: baseMessage,
				showCopyButton: true,
				missingSecretWarning: warning,
			}),
		);

		const markdown = container.querySelector('[data-testid="markdown"]');
		const warningEl = container.querySelector('[data-testid="warning"]');
		const copyButton = container.querySelector('[data-testid="copy-button"]');

		expect(markdown).not.toBeNull();
		expect(warningEl).not.toBeNull();
		expect(copyButton).not.toBeNull();

		expect(
			markdown && (markdown.compareDocumentPosition(warningEl as Node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
		).toBe(true);
		expect(
			warningEl &&
				(warningEl.compareDocumentPosition(copyButton as Node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
		).toBe(true);
	});

	test("the copy button only ever receives the main markdown text, never the warning text", () => {
		const { getByTestId } = render(
			createElement(AssistantMessage, {
				message: baseMessage,
				showCopyButton: true,
				missingSecretWarning: warning,
			}),
		);

		expect(getByTestId("copy-button").textContent).toBe(baseMessage.description);
		expect(getByTestId("copy-button").textContent).not.toContain("Ютрек");
	});

	test("renders no warning block when missingSecretWarning is null/undefined", () => {
		const { queryByTestId } = render(
			createElement(AssistantMessage, { message: baseMessage, showCopyButton: true }),
		);
		expect(queryByTestId("warning")).toBeNull();

		const { queryByTestId: queryByTestId2 } = render(
			createElement(AssistantMessage, { message: baseMessage, showCopyButton: true, missingSecretWarning: null }),
		);
		expect(queryByTestId2("warning")).toBeNull();
	});

	test("passes every missing secret through to the warning component", () => {
		const multi: MissingSecretWarningViewModel = { secrets: ["A.token", "B.login"] };
		const { getByTestId } = render(
			createElement(AssistantMessage, {
				message: baseMessage,
				showCopyButton: true,
				missingSecretWarning: multi,
			}),
		);

		expect(getByTestId("warning").textContent).toBe("A.token, B.login");
	});
});
