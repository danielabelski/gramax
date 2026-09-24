import type { SessionStatePayload } from "@ext/agent/components/types/chat";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const STORAGE_VERSION = 1;

interface AgentStoreState {
	activeSessionId: string | null;
	sessions: SessionStatePayload[];
	setActiveSessionId: (id: string) => void;
	clearActiveSessionId: () => void;
	setSessions: (sessions: SessionStatePayload[]) => void;
	upsertSession: (session: SessionStatePayload) => void;
	removeSession: (id: string) => void;
}

const useAgentStore = create<AgentStoreState>()(
	persist(
		(set) => ({
			activeSessionId: null,
			sessions: [],
			setActiveSessionId: (id) => set({ activeSessionId: id }),
			clearActiveSessionId: () => set({ activeSessionId: null }),
			setSessions: (sessions) => set({ sessions }),
			upsertSession: (session) =>
				set((state) => ({
					sessions: [...state.sessions.filter((s) => s.id !== session.id), session],
				})),
			removeSession: (id) => set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) })),
		}),
		{
			name: "agent-state",
			partialize: (s) => ({ activeSessionId: s.activeSessionId }),
			version: STORAGE_VERSION,
			migrate: (persistedState) => {
				const { apiKey, ...state } = persistedState as { apiKey?: string; activeSessionId?: string | null };
				return state;
			},
		},
	),
);

export const useStoredSessions = () => useAgentStore((s) => s.sessions);
export const useActiveSessionId = () => useAgentStore((s) => s.activeSessionId);
export const useActiveSessionUsage = () =>
	useAgentStore((s) => s.sessions.find((sess) => sess.id === s.activeSessionId)?.usage);
export const useActiveSessionBrowser = () =>
	useAgentStore((s) => s.sessions.find((sess) => sess.id === s.activeSessionId)?.browser);

export const getActiveSessionId = () => useAgentStore.getState().activeSessionId;
export const getSessions = () => useAgentStore.getState().sessions;

export const setActiveSessionId = (id: string) => useAgentStore.getState().setActiveSessionId(id);
export const clearActiveSessionId = () => useAgentStore.getState().clearActiveSessionId();
export const setSessions = (sessions: SessionStatePayload[]) => useAgentStore.getState().setSessions(sessions);
export const upsertSession = (session: SessionStatePayload) => useAgentStore.getState().upsertSession(session);
export const removeSession = (id: string) => useAgentStore.getState().removeSession(id);
