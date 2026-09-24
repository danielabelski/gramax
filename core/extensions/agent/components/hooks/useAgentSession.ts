import FetchService from "@core-ui/ApiServices/FetchService";
import Method from "@core-ui/ApiServices/Types/Method";
import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import { useItemLinksStore } from "@core-ui/stores/ItemLinksStore/ItemLinksStore.provider";
import { refreshPage } from "@core-ui/utils/initGlobalFuncs";
import AgentSkillService from "@ext/agent/components/skills/AgentSkillService";
import type { AgentEvent } from "@ext/agent/core/events";
import t from "@ext/localization/locale/translate";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSessions, upsertSession } from "../store/AgentStore";
import type { SessionStatePayload } from "../types/chat";
import { isSessionStatePayloadEqual } from "../utils/sessionStateEquality";

type Args = {
	sessionId: string | null;
	openCatalogName: string | null;
	openItemPath: string | null;
	applyEvents: (events: AgentEvent[]) => void;
	replaceEvents: (events: AgentEvent[]) => void;
	resetTimeline: () => void;
	stopPolling: () => void;
};

export const useAgentSession = ({
	sessionId,
	openCatalogName,
	openItemPath,
	applyEvents,
	replaceEvents,
	resetTimeline,
	stopPolling,
}: Args) => {
	const [sessionLoading, setSessionLoading] = useState(false);
	const [sessionError, setSessionError] = useState<string | null>(null);
	const processedEventsRef = useRef(0);
	const activeSessionIdRef = useRef(sessionId);
	const loadGenRef = useRef(0);
	const openCatalogNameRef = useRef(openCatalogName);
	const openItemPathRef = useRef(openItemPath);
	const apiUrlCreatorRef = useRef(ApiUrlCreatorService.value);
	const setItemLinks = useItemLinksStore((s) => s.setItemLinks);

	activeSessionIdRef.current = sessionId;
	openCatalogNameRef.current = openCatalogName;
	openItemPathRef.current = openItemPath;
	apiUrlCreatorRef.current = ApiUrlCreatorService.value;

	const fetchSessionState = useCallback(async (): Promise<SessionStatePayload | null> => {
		const id = activeSessionIdRef.current;
		if (!id) return null;

		const url = apiUrlCreatorRef.current.getAgentSessionStateUrl(id);
		url.query = {
			...(url.query ?? {}),
			openCatalogName: openCatalogNameRef.current,
			openItemPath: openItemPathRef.current,
		};

		const res = await FetchService.fetch<SessionStatePayload>(url, undefined, MimeTypes.json, Method.GET, false);
		if (!res.ok) return null;
		return (await res.json()) ?? null;
	}, []);

	const flushSessionEvents = useCallback(
		(data: SessionStatePayload): AgentEvent[] => {
			const events = data.events ?? [];
			const from = processedEventsRef.current;
			if (events.length < from) return [];

			const nextEvents = events.slice(from);
			processedEventsRef.current = events.length;

			if (from === 0) {
				replaceEvents(nextEvents);
			} else if (nextEvents.length) {
				applyEvents(nextEvents);
			}

			const prev = getSessions().find((s) => s.id === data.id);
			if (prev && isSessionStatePayloadEqual(prev, data)) return nextEvents;
			upsertSession(data);
			return nextEvents;
		},
		[applyEvents, replaceEvents],
	);

	const applySessionState = useCallback(
		(data: SessionStatePayload | null, opts: { refreshEvents?: boolean } = {}): AgentEvent[] => {
			if (!data || data.error || data.id !== activeSessionIdRef.current) return [];

			if (data.itemLinks) setItemLinks(data.itemLinks);
			if (data.skills) AgentSkillService.setItems(data.skills, true);

			const nextEvents = flushSessionEvents(data);
			if (opts.refreshEvents !== false) {
				for (const event of nextEvents) {
					if ("refreshPage" in event && event.refreshPage) void refreshPage();
				}
			}

			return nextEvents;
		},
		[flushSessionEvents, setItemLinks],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reload only when session changes
	useEffect(() => {
		stopPolling();

		if (!sessionId) {
			resetTimeline();
			setSessionLoading(false);
			return;
		}

		const gen = ++loadGenRef.current;
		setSessionLoading(true);
		setSessionError(null);
		processedEventsRef.current = 0;
		resetTimeline();

		fetchSessionState()
			.then((state) => {
				if (gen !== loadGenRef.current) return;
				if (state) applySessionState(state, { refreshEvents: false });
				else setSessionError(t("agent.chat-error.load-history-error"));
			})
			.catch(() => {
				if (gen !== loadGenRef.current) return;
				setSessionError(t("agent.chat-error.load-history-error"));
			})
			.finally(() => {
				if (gen !== loadGenRef.current) return;
				setSessionLoading(false);
			});
	}, [sessionId]);

	return { sessionLoading, sessionError, fetchSessionState, applySessionState };
};
