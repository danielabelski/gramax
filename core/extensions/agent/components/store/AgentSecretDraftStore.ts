import { create } from "zustand";

export type PendingAgentSecretDraft = {
	key: string;
	kind: "token" | "login";
	focus?: "key" | "login" | "value" | "url";
	requestId: string;
};

type AgentSecretDraftState = {
	pendingDraft: PendingAgentSecretDraft | null;
	setPendingDraft: (draft: Omit<PendingAgentSecretDraft, "requestId">) => void;
	consumePendingDraft: () => PendingAgentSecretDraft | null;
};

/** One-shot, non-persisted request to prefill a keys-and-passwords draft row — cleared on read or reload. */
export const useAgentSecretDraftStore = create<AgentSecretDraftState>((set, get) => ({
	pendingDraft: null,

	setPendingDraft: (draft) => {
		set({ pendingDraft: { ...draft, requestId: crypto.randomUUID() } });
	},

	consumePendingDraft: () => {
		const draft = get().pendingDraft;
		set({ pendingDraft: null });
		return draft;
	},
}));
