import Method from "@core-ui/ApiServices/Types/Method";
import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import { useApi, useDeferApi } from "@core-ui/hooks/useApi";
import type { AgentQuote } from "@ext/agent/core/events";
import { useCallback, useEffect, useRef, useState } from "react";
import { setQuote, useChatQuote } from "../store/ChatStore";
import type { AgentDraftAttachment, AgentDraftSnapshot, AgentDraftType } from "../types/chat";

const LOAD_DRAFT_OPTS = { method: Method.GET, mime: MimeTypes.json, consumeError: true } as const;
const SAVE_DRAFT_OPTS = { method: Method.POST, mime: MimeTypes.json, consumeError: true } as const;

const areDraftAttachmentsEqual = (a: AgentDraftAttachment[], b: AgentDraftAttachment[]): boolean => {
	if (a.length !== b.length) return false;
	return a.every((left, index) => {
		const right = b[index];
		return (
			left.name === right?.name &&
			left.mime === right.mime &&
			left.size === right.size &&
			left.content === right.content
		);
	});
};

export const useDraftPersistence = (sessionId: string | null, sendingRef: { current: boolean }) => {
	const [draft, setDraft] = useState("");
	const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null);
	const [draftAttachments, setDraftAttachments] = useState<AgentDraftAttachment[]>([]);
	const [hydrating, setHydrating] = useState(false);
	const quote = useChatQuote();

	const { call: callLoadDraft, reset: resetLoadDraft } = useApi<AgentDraftSnapshot | null>({
		url: (api) => api.getAgentSessionDraftUrl(sessionId),
		opts: LOAD_DRAFT_OPTS,
	});
	const { call: callSaveDraft } = useDeferApi<{ ok: true }>({
		url: (api) => api.getAgentSessionSaveDraftUrl(),
		opts: SAVE_DRAFT_OPTS,
	});
	const { call: callClearDraft } = useDeferApi<{ ok: true }>({
		url: (api) => api.getAgentSessionSaveDraftUrl(),
		opts: SAVE_DRAFT_OPTS,
	});

	const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hydratedFor = useRef<string | null>(null);
	const hydratedBaseline = useRef<AgentDraftType | null>(null);
	const dirtyRef = useRef(false);

	const draftRef = useRef(draft);
	draftRef.current = draft;
	const selectedSkillNameRef = useRef(selectedSkillName);
	selectedSkillNameRef.current = selectedSkillName;
	const draftAttachmentsRef = useRef(draftAttachments);
	draftAttachmentsRef.current = draftAttachments;
	const quoteRef = useRef(quote);
	quoteRef.current = quote;

	const persistDraft = useCallback(
		(
			sid: string,
			text: string,
			skill: string | null,
			attachments: AgentDraftAttachment[] = [],
			quote: AgentQuote | null = null,
		) => {
			const snapshot: AgentDraftSnapshot = {
				text,
				selectedSkillName: skill,
				updatedAt: Date.now(),
				attachments,
				quote,
			};
			void callSaveDraft({ opts: { body: JSON.stringify({ sessionId: sid, draft: snapshot }) } });
		},
		[callSaveDraft],
	);

	const saveSnapshot = useCallback(
		(sid: string) => {
			dirtyRef.current = false;
			persistDraft(
				sid,
				draftRef.current,
				selectedSkillNameRef.current,
				draftAttachmentsRef.current,
				quoteRef.current,
			);
		},
		[persistDraft],
	);

	const flushDraft = useCallback(() => {
		if (saveTimer.current) clearTimeout(saveTimer.current);
		saveTimer.current = null;
		dirtyRef.current = false;
	}, []);

	const clearOnSend = useCallback(
		(sid: string, skill: string | null) => {
			void callClearDraft({
				opts: {
					body: JSON.stringify({
						sessionId: sid,
						draft: {
							text: "",
							selectedSkillName: skill,
							updatedAt: Date.now(),
							attachments: [],
							quote: null,
						},
					}),
				},
			});
		},
		[callClearDraft],
	);

	const restoreBaseline = useCallback(
		(text: string, skill: string | null, attachments: AgentDraftAttachment[], quote: AgentQuote | null) => {
			hydratedBaseline.current = { text, skill, attachments, quote };
		},
		[],
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset + hydrate on session change
	useEffect(() => {
		if (!sessionId) return;

		hydratedFor.current = null;
		hydratedBaseline.current = null;
		setHydrating(true);
		setDraft("");
		setSelectedSkillName(null);
		setDraftAttachments([]);
		setQuote(null);

		let cancelled = false;
		resetLoadDraft();
		void Promise.resolve(callLoadDraft()).then((loaded) => {
			if (cancelled) return;
			const text = loaded?.text ?? "";
			const skill = loaded?.selectedSkillName ?? null;
			const attachments = loaded?.attachments ?? [];
			const loadedQuote = loaded?.quote ?? null;
			hydratedBaseline.current = { text, skill, attachments, quote: loadedQuote };
			setDraft(text);
			setSelectedSkillName(skill);
			setDraftAttachments(attachments);
			setQuote(loadedQuote);
			hydratedFor.current = sessionId;
			setHydrating(false);
		});
		return () => {
			cancelled = true;
		};
	}, [sessionId]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: debounced persist of the draft
	useEffect(() => {
		if (!sessionId) return;
		if (hydratedFor.current !== sessionId) return;
		const base = hydratedBaseline.current;
		if (
			base &&
			base.text === draft &&
			base.skill === selectedSkillName &&
			base.quote === quote &&
			areDraftAttachmentsEqual(base.attachments, draftAttachments)
		)
			return;
		hydratedBaseline.current = null;
		if (sendingRef.current) return;

		dirtyRef.current = true;
		if (saveTimer.current) clearTimeout(saveTimer.current);
		saveTimer.current = setTimeout(() => {
			saveTimer.current = null;
			saveSnapshot(sessionId);
		}, 400);
		return () => {
			if (saveTimer.current) clearTimeout(saveTimer.current);
		};
	}, [draft, selectedSkillName, sessionId, draftAttachments, quote]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: flush previous session's pending draft
	useEffect(() => {
		const sid = sessionId;
		return () => {
			if (!sid) return;
			if (saveTimer.current) {
				clearTimeout(saveTimer.current);
				saveTimer.current = null;
			}
			if (dirtyRef.current) saveSnapshot(sid);
		};
	}, [sessionId]);

	return {
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
	};
};
