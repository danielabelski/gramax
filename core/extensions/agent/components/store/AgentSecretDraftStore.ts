import { create } from "zustand";

export type PendingAgentSecretDraft = {
	key: string;
	kind: "token" | "login";
	focus?: "key" | "login" | "value" | "url";
	requestId: string;
};

type AgentSecretDraftState = {
	pendingDrafts: PendingAgentSecretDraft[];
	setPendingDrafts: (drafts: Omit<PendingAgentSecretDraft, "requestId">[]) => void;
	consumePendingDrafts: () => PendingAgentSecretDraft[];
};

/** One-shot, non-persisted request to prefill one or more keys-and-passwords draft rows — cleared on read or reload. */
export const useAgentSecretDraftStore = create<AgentSecretDraftState>((set, get) => ({
	pendingDrafts: [],

	setPendingDrafts: (drafts) => {
		set({ pendingDrafts: drafts.map((draft) => ({ ...draft, requestId: crypto.randomUUID() })) });
	},

	consumePendingDrafts: () => {
		const drafts = get().pendingDrafts;
		set({ pendingDrafts: [] });
		return drafts;
	},
}));
