import type { AgentDraftAttachment, ChatMessage, SessionTabItem } from "@ext/agent/components/types/chat";
import type { AgentQuote } from "@ext/agent/core/events";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

interface ChatStoreState {
	sessions: SessionTabItem[];
	activeSessionId: string | null;
	sessionError: string | null;

	messages: ChatMessage[];
	streamingMessageId: string | null;
	streamText: string;
	showAgentThinking: boolean;

	draft: string;
	attachments: AgentDraftAttachment[];
	quote: AgentQuote | null;
	sessionLoading: boolean;
	hydrating: boolean;
	isSending: boolean;
	catalogName: string | null;
	selectedSkillName: string | null;
	browserAllowed: boolean;

	onSelectSession: (id: string) => void;
	onCloseTab: (id: string) => void;
	onRenameSession: (id: string, title: string) => void;
	onNewSession: () => void;
	onDraftChange: (value: string) => void;
	onAttachmentsChange: (files: AgentDraftAttachment[]) => void;
	onSubmit: () => void;
	onCancel: (() => void) | null;
	onSkillChange: (name: string | null) => void;
	onBrowserAllowedChange: (allowed: boolean) => void;

	set: (patch: Partial<Omit<ChatStoreState, "set">>) => void;
}

const useChatStore = create<ChatStoreState>()((set) => ({
	sessions: [],
	activeSessionId: null,
	sessionError: null,

	messages: [],
	streamingMessageId: null,
	streamText: "",
	showAgentThinking: false,

	draft: "",
	attachments: [],
	quote: null,
	sessionLoading: false,
	hydrating: false,
	isSending: false,
	catalogName: null,
	selectedSkillName: null,
	browserAllowed: false,

	onSelectSession: () => {},
	onCloseTab: () => {},
	onRenameSession: () => {},
	onNewSession: () => {},
	onDraftChange: () => {},
	onAttachmentsChange: () => {},
	onSubmit: () => {},
	onCancel: null,
	onSkillChange: () => {},
	onBrowserAllowedChange: () => {},

	set: (patch) => set(patch),
}));

export const useChatSessions = () =>
	useChatStore(
		useShallow((s) => ({ sessions: s.sessions, activeSessionId: s.activeSessionId, sessionError: s.sessionError })),
	);

export const useChatMessages = () =>
	useChatStore(
		useShallow((s) => ({
			messages: s.messages,
			streamingMessageId: s.streamingMessageId,
			showAgentThinking: s.showAgentThinking,
		})),
	);

export const useChatStreamText = (active: boolean) => useChatStore((s) => (active ? s.streamText : ""));

export const useChatDraft = () => useChatStore(useShallow((s) => ({ draft: s.draft, onDraftChange: s.onDraftChange })));

export const useChatQuote = () => useChatStore((s) => s.quote);

export const useChatInput = () =>
	useChatStore(
		useShallow((s) => ({
			attachments: s.attachments,
			inputDisabled: s.isSending || s.sessionLoading || !s.activeSessionId || s.hydrating,
			isSending: s.isSending,
			catalogName: s.catalogName,
			selectedSkillName: s.selectedSkillName,
			browserAllowed: s.browserAllowed,
			onAttachmentsChange: s.onAttachmentsChange,
			onSubmit: s.onSubmit,
			onCancel: s.onCancel,
			onSkillChange: s.onSkillChange,
			onBrowserAllowedChange: s.onBrowserAllowedChange,
		})),
	);

export const useChatInputDisabled = () => useChatStore((s) => s.isSending || s.sessionLoading || !s.activeSessionId);

export const useChatHeaderActions = () =>
	useChatStore(
		useShallow((s) => ({
			sessions: s.sessions,
			activeSessionId: s.activeSessionId,
			onSelectSession: s.onSelectSession,
			onCloseTab: s.onCloseTab,
			onRenameSession: s.onRenameSession,
			onNewSession: s.onNewSession,
		})),
	);

export const setChatState = (patch: Partial<Omit<ChatStoreState, "set">>) => useChatStore.getState().set(patch);
export const setQuote = (quote: AgentQuote | null) => setChatState({ quote });

export default useChatStore;
