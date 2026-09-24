import { memo, type Ref } from "react";
import type { ChatMessage } from "../../types/chat";
import type { MissingSecretWarning } from "../getMissingSecretsFromToolResult";
import { AssistantMessage } from "./AssistantMessage";
import { CancelledStatusMessage } from "./CancelledStatusMessage";
import { ContextCompactedMessage } from "./ContextCompactedMessage";
import { ErrorStatusMessage } from "./ErrorStatusMessage";
import { UserMessage } from "./UserMessage";
import { WarningStatusMessage } from "./WarningStatusMessage";

export type MessageCardProps = {
	message: ChatMessage;
	streamDescription?: boolean;
	stickyUserPrompt?: boolean;
	userPromptAnchorRef?: Ref<HTMLDivElement>;
	responseRef?: Ref<HTMLDivElement>;
	copyButtonMessageId?: string | null;
	cancelledDurationMs?: number;
	footerAlwaysVisible?: boolean;
	missingSecretWarning?: MissingSecretWarning | null;
	missingSecretWarningMessageId?: string | null;
};

const messageCardPropsAreEqual = (prev: MessageCardProps, next: MessageCardProps): boolean =>
	prev.message.id === next.message.id &&
	prev.message.kind === next.message.kind &&
	prev.streamDescription === next.streamDescription &&
	prev.stickyUserPrompt === next.stickyUserPrompt &&
	prev.userPromptAnchorRef === next.userPromptAnchorRef &&
	prev.responseRef === next.responseRef &&
	prev.copyButtonMessageId === next.copyButtonMessageId &&
	prev.cancelledDurationMs === next.cancelledDurationMs &&
	prev.footerAlwaysVisible === next.footerAlwaysVisible &&
	prev.missingSecretWarning === next.missingSecretWarning &&
	prev.missingSecretWarningMessageId === next.missingSecretWarningMessageId;

export const MessageCard = memo(
	({
		message,
		streamDescription = false,
		stickyUserPrompt = false,
		userPromptAnchorRef,
		responseRef,
		copyButtonMessageId,
		cancelledDurationMs,
		footerAlwaysVisible,
		missingSecretWarning,
		missingSecretWarningMessageId,
	}: MessageCardProps) => {
		switch (message.kind) {
			case "user":
				return (
					<UserMessage
						attachments={message.attachments}
						quotedText={message.quotedText}
						stickyUserPrompt={stickyUserPrompt}
						userPromptAnchorRef={userPromptAnchorRef}
						userText={message.userText}
					/>
				);
			case "error":
				return (
					<ErrorStatusMessage
						errorType={message.errorType}
						responseRef={responseRef}
						statusText={message.statusText}
					/>
				);
			case "warning":
				return <WarningStatusMessage responseRef={responseRef} statusText={message.statusText} />;
			case "cancelled":
				return <CancelledStatusMessage durationMs={cancelledDurationMs} responseRef={responseRef} />;
			case "context_compacted":
				return <ContextCompactedMessage responseRef={responseRef} />;
			case "assistant":
				return (
					<AssistantMessage
						footerAlwaysVisible={footerAlwaysVisible}
						message={message}
						missingSecretWarning={
							missingSecretWarningMessageId === message.id ? missingSecretWarning : null
						}
						responseRef={responseRef}
						showCopyButton={copyButtonMessageId === message.id}
						streamDescription={streamDescription}
					/>
				);
			default:
				return null;
		}
	},
	messageCardPropsAreEqual,
);
MessageCard.displayName = "MessageCard";
