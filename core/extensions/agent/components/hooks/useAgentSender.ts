import FetchService from "@core-ui/ApiServices/FetchService";
import Method from "@core-ui/ApiServices/Types/Method";
import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import ApiUrlCreatorService from "@core-ui/ContextServices/ApiUrlCreator";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import SourceDataService from "@core-ui/ContextServices/SourceDataService";
import WorkspaceService from "@core-ui/ContextServices/Workspace";
import { useApi, useDeferApi } from "@core-ui/hooks/useApi";
import type { AgentEvent } from "@ext/agent/core/events";
import type { AgentLlmEndpoint } from "@ext/agent/llm";
import { getEnterpriseSourceData } from "@ext/enterprise/utils/getEnterpriseSourceData";
import t from "@ext/localization/locale/translate";
import { useWorkspaceAi } from "@ext/workspace/components/useWorkspaceAi";
import { useCallback, useState } from "react";
import { setQuote, useChatQuote } from "../store/ChatStore";
import type { SessionStatePayload } from "../types/chat";
import { snapshotAgentSession } from "../utils/agentSessionActivity";
import { useAgentAttachments } from "./useAgentAttachments";
import { useAgentPollTick } from "./useAgentPollTick";
import { useDraftPersistence } from "./useDraftPersistence";

type MessageSendPayload = {
	sessionId?: string;
	error?: string;
	message?: string;
};

const CANCEL_OPTS = {
	method: Method.POST,
	mime: MimeTypes.json,
	consumeError: true,
} as const;

const errorText = (data: MessageSendPayload | null, fallback: string): string => {
	switch (data?.error) {
		case "session_not_found":
			return t("agent.chat-error.session-not-found");
		case "session_cancelled":
			return t("agent.chat-error.session-cancelled");
		case "empty_message":
			return t("agent.chat-error.empty-message");
		case "agent_failed":
			return t("agent.chat-error.agent-failed");
		default:
			return fallback;
	}
};

const getChatCompletionsUrl = (baseUrl: string | undefined) => {
	if (!baseUrl) return undefined;
	const trimmed = baseUrl.replace(/\/+$/, "");
	return `${trimmed}/openaiapi/chat/completions`;
};

type Args = {
	sessionId: string | null;
	sessionLoading: boolean;
	openCatalogName: string | null;
	openItemPath: string | null;
	fetchSessionState: () => Promise<SessionStatePayload | null>;
	applySessionState: (data: SessionStatePayload | null) => AgentEvent[];
	startPolling: (tick: () => Promise<void> | void) => void;
	stopPolling: () => void;
	appendError: (message: string) => void;
};

export const useAgentSender = ({
	sessionId,
	sessionLoading,
	openCatalogName,
	openItemPath,
	fetchSessionState,
	applySessionState,
	startPolling,
	stopPolling,
	appendError,
}: Args) => {
	const workspacePath = WorkspaceService.current()?.path ?? "";
	const sourceDatas = SourceDataService.value;
	const { getData: getWorkspaceAiData } = useWorkspaceAi(workspacePath);
	const apiUrlCreator = ApiUrlCreatorService.value;

	const [browserAllowed, setBrowserAllowedState] = useState(false);
	const { call: callSetBrowserAllowed } = useDeferApi<unknown>({
		url: (api) => api.getAgentBrowserSetAllowedUrl(),
		opts: { method: Method.POST, mime: MimeTypes.json, consumeError: true },
	});

	const setBrowserAllowed = useCallback(
		(allowed: boolean) => {
			setBrowserAllowedState(allowed);
			void callSetBrowserAllowed({ opts: { body: JSON.stringify({ allowed }) } });
		},
		[callSetBrowserAllowed],
	);

	const {
		sending,
		setSending,
		sendingRef,
		showAgentThinking,
		setShowAgentThinkingIfChanged,
		sessionSnapshotRef,
		pollTickRef,
	} = useAgentPollTick({
		sessionId,
		sessionLoading,
		openCatalogName,
		openItemPath,
		fetchSessionState,
		flushAndRefresh: applySessionState,
		startPolling,
		stopPolling,
	});

	const {
		draft,
		setDraft,
		selectedSkillName,
		setSelectedSkillName,
		draftAttachments,
		setDraftAttachments,
		hydrating,
		flushDraft,
		persistDraft,
		clearOnSend,
		restoreBaseline,
	} = useDraftPersistence(sessionId, sendingRef);

	const { attachments, setAttachments } = useAgentAttachments({
		sessionId,
		draftAttachments,
		setDraftAttachments,
		hydrating,
	});

	const quote = useChatQuote();

	const { call: callCancel } = useApi<void>({
		url: (api) => api.getAgentSessionCancelUrl(sessionId ?? ""),
		opts: CANCEL_OPTS,
	});

	const { gesUrl } = PageDataContextService.value.conf.enterprise;
	const { url: gesCloudUrl, enabled: gesCloudEnabled } = PageDataContextService.value.conf.enterpriseCloud;

	const send = useCallback(async () => {
		const text = draft.trim();
		if (!text || sending) return;

		const pickedAttachments = attachments;
		const pickedSkill = selectedSkillName;
		const pickedDraftAttachments = draftAttachments;
		const pickedQuote = quote;
		const restoreDraft = () => {
			setDraft(text);
			setAttachments(pickedAttachments);
			setDraftAttachments(pickedDraftAttachments);
			setQuote(pickedQuote);
			if (sessionId) {
				persistDraft(sessionId, text, pickedSkill, pickedDraftAttachments, pickedQuote);
				restoreBaseline(text, pickedSkill, pickedDraftAttachments, pickedQuote);
			}
		};
		setSending(true);
		sendingRef.current = true;
		sessionSnapshotRef.current = snapshotAgentSession(null);
		setShowAgentThinkingIfChanged(true);
		flushDraft();
		setDraft("");
		setAttachments([]);
		setDraftAttachments([]);
		setQuote(null);

		try {
			const activeId = sessionId;
			if (!activeId) {
				restoreDraft();
				appendError(t("agent.chat-error.no-active-session"));
				return;
			}

			clearOnSend(activeId, pickedSkill);

			startPolling(() => pollTickRef.current().then(() => undefined));

			let endpoint: AgentLlmEndpoint;
			if (gesUrl) {
				endpoint = {
					kind: "enterprise",
					url: getChatCompletionsUrl(gesUrl) ?? "",
					token: getEnterpriseSourceData(sourceDatas ?? [], gesUrl)?.token ?? "",
				};
			} else if (gesCloudUrl && gesCloudEnabled) {
				endpoint = { kind: "enterpriseCloud", url: getChatCompletionsUrl(gesCloudUrl) ?? "" };
			} else {
				const workspaceAiData = await getWorkspaceAiData().catch(() => undefined);
				const workspaceUrl = getChatCompletionsUrl(workspaceAiData?.aiApiUrl);
				if (!workspaceUrl) {
					restoreDraft();
					appendError(t("agent.error-type.unauthorized"));
					return;
				}

				endpoint = { kind: "direct", url: workspaceUrl, apiKey: workspaceAiData?.aiToken ?? "" };
			}

			// DeferApi does not support parallel requests
			const res = await FetchService.fetch<MessageSendPayload>(
				apiUrlCreator.getAgentMessageSendUrl(),
				JSON.stringify({
					sessionId: activeId,
					text,
					endpoint,
					attachments: pickedAttachments,
					quote: pickedQuote ?? undefined,
					openCatalogName,
					openItemPath,
					useSkill: pickedSkill,
				}),
				MimeTypes.json,
				Method.POST,
				false,
			);

			if (!res.ok) {
				const httpErrorBody = (await res.json().catch(() => null)) as MessageSendPayload | null;
				restoreDraft();
				appendError(errorText(httpErrorBody, t("agent.chat-error.send-message-error")));
				return;
			}

			const data = (await res.json()) as MessageSendPayload | null;
			if (!data) {
				restoreDraft();
				appendError(t("agent.chat-error.send-message-error"));
				return;
			}

			if (data.error) {
				restoreDraft();
				appendError(errorText(data, t("agent.chat-error.get-response-error")));
				return;
			}
		} catch {
			restoreDraft();
			appendError(t("agent.chat-error.agent-failed"));
		} finally {
			sendingRef.current = false;
			await pollTickRef.current();
		}
	}, [
		appendError,
		attachments,
		clearOnSend,
		draft,
		draftAttachments,
		gesCloudUrl,
		gesCloudEnabled,
		flushDraft,
		gesUrl,
		openCatalogName,
		openItemPath,
		persistDraft,
		pollTickRef,
		quote,
		restoreBaseline,
		selectedSkillName,
		sending,
		sendingRef,
		sessionId,
		sessionSnapshotRef,
		setAttachments,
		setDraft,
		setDraftAttachments,
		setSending,
		startPolling,
		setShowAgentThinkingIfChanged,
		getWorkspaceAiData,
	]);

	const cancel = useCallback(async () => {
		if (!sessionId) return;
		sendingRef.current = false;
		setShowAgentThinkingIfChanged(false);
		sessionSnapshotRef.current = snapshotAgentSession(null);
		stopPolling();
		await callCancel();
		await pollTickRef.current();
	}, [
		callCancel,
		pollTickRef,
		sendingRef,
		sessionId,
		sessionSnapshotRef,
		stopPolling,
		setShowAgentThinkingIfChanged,
	]);

	return {
		draft,
		setDraft,
		attachments,
		setAttachments,
		selectedSkillName,
		setSelectedSkillName,
		browserAllowed,
		setBrowserAllowed,
		send,
		cancel,
		sending,
		hydrating,
		showAgentThinking,
	};
};
