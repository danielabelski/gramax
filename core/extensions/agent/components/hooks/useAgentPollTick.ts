import { useCallback, useEffect, useRef, useState } from "react";
import { getSessions } from "../store/AgentStore";
import type { SessionStatePayload } from "../types/chat";
import {
	type AgentSessionSnapshot,
	shouldShowAgentThinkingSpinner,
	snapshotAgentSession,
} from "../utils/agentSessionActivity";

type Args = {
	sessionId: string | null;
	sessionLoading: boolean;
	openCatalogName: string | null;
	openItemPath: string | null;
	fetchSessionState: () => Promise<SessionStatePayload | null>;
	flushAndRefresh: (state: SessionStatePayload | null) => void;
	startPolling: (tick: () => Promise<void> | void) => void;
	stopPolling: () => void;
};

export const useAgentPollTick = ({
	sessionId,
	sessionLoading,
	openCatalogName,
	openItemPath,
	fetchSessionState,
	flushAndRefresh,
	startPolling,
	stopPolling,
}: Args) => {
	const [sending, setSending] = useState(false);
	const [showAgentThinking, setShowAgentThinking] = useState(false);
	const sendingRef = useRef(false);
	const sessionSnapshotRef = useRef<AgentSessionSnapshot>(snapshotAgentSession(null));

	const setShowAgentThinkingIfChanged = useCallback((next: boolean) => {
		setShowAgentThinking((prev) => (prev === next ? prev : next));
	}, []);

	const syncBusyState = useCallback(
		(snapshot: AgentSessionSnapshot) => {
			const busy = snapshot.processing || sendingRef.current;
			setSending(busy);
			setShowAgentThinkingIfChanged(shouldShowAgentThinkingSpinner(snapshot, { isSending: sendingRef.current }));
			if (!busy) {
				stopPolling();
				setShowAgentThinkingIfChanged(false);
			}
			return busy;
		},
		[stopPolling, setShowAgentThinkingIfChanged],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset sending state on session change
	useEffect(() => {
		if (!sessionId) return;
		setSending(false);
		sendingRef.current = false;
		const cached = getSessions().find((s) => s.id === sessionId);
		sessionSnapshotRef.current = cached ? snapshotAgentSession(cached) : snapshotAgentSession(null);
		syncBusyState(sessionSnapshotRef.current);
	}, [sessionId]);

	const pollTick = useCallback(async (): Promise<boolean> => {
		if (!sessionId) return false;

		const state = await fetchSessionState();
		if (!state) return true;

		flushAndRefresh(state);
		sessionSnapshotRef.current = snapshotAgentSession(state);
		return syncBusyState(sessionSnapshotRef.current);
	}, [sessionId, fetchSessionState, flushAndRefresh, syncBusyState]);

	const pollTickRef = useRef(pollTick);
	pollTickRef.current = pollTick;

	// biome-ignore lint/correctness/useExhaustiveDependencies: resume poll after session load completes
	useEffect(() => {
		if (!sessionId || sessionLoading) return;
		void pollTickRef.current().then((busy) => {
			if (busy) startPolling(() => pollTickRef.current().then(() => undefined));
		});
	}, [sessionId, sessionLoading, openCatalogName, openItemPath]);

	return {
		sending,
		setSending,
		sendingRef,
		showAgentThinking,
		setShowAgentThinkingIfChanged,
		sessionSnapshotRef,
		pollTickRef,
	};
};
