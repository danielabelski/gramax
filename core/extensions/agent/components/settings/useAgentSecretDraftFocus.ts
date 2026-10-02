import { useAgentSecretDraftStore } from "@ext/agent/components/store/AgentSecretDraftStore";
import { useCallback, useEffect, useState } from "react";
import type { UseFieldArrayPrepend, UseFormReturn } from "react-hook-form";
import { type AgentSecretsFormData, normalizeSecretKey, type SecretKind, type SecretRow } from "./secretRow";

type InitialSecretDraft = { key?: string; kind?: SecretKind; requestId?: string };

type PendingFocus = { rowId: string; focus: "key" | "login" | "value" | "url" };

const draftRow = (draft?: InitialSecretDraft): SecretRow => ({
	id: draft?.requestId ?? crypto.randomUUID(),
	key: draft?.key ?? "",
	savedKey: "",
	value: "",
	kind: draft?.kind ?? "token",
	login: "",
	url: "",
});

type UseAgentSecretDraftFocusParams = {
	form: UseFormReturn<AgentSecretsFormData>;
	prepend: UseFieldArrayPrepend<AgentSecretsFormData, "rows">;
	isLoading: boolean;
};

/**
 * Owns "which field should be focused right now" for the keys-and-passwords table: adding a blank
 * draft row (the "+" button), and consuming a pending draft request from a missing-secret warning
 * click (prefilling and focusing either a new row or an existing one with a matching key).
 */
export const useAgentSecretDraftFocus = ({ form, prepend, isLoading }: UseAgentSecretDraftFocusParams) => {
	const [pendingFocus, setPendingFocus] = useState<PendingFocus | null>(null);

	/** Prepends a blank, not-yet-persisted row. Missing-secret draft consumption sets focus separately. */
	const addDraftSecret = useCallback(
		(draft?: InitialSecretDraft) => {
			const row = draftRow(draft);
			prepend(row, { shouldFocus: false });
			setPendingFocus({ rowId: row.id, focus: "key" });
		},
		[prepend],
	);

	/**
	 * Consumes pending drafts (e.g. from a missing-secret warning click) once the secret list has
	 * loaded. Several drafts can arrive together — one warning can name a missing token and a missing
	 * login at once — so every draft without a matching row gets prepended in one batch; only the
	 * first draft (matched or newly added) receives focus, since a single field can be focused at a time.
	 */
	useEffect(() => {
		if (isLoading) return;

		const drafts = useAgentSecretDraftStore.getState().consumePendingDrafts();
		if (!drafts.length) return;

		const existingRows = form.getValues("rows");
		const newRows: SecretRow[] = [];
		let firstFocus: PendingFocus | null = null;

		for (const draft of drafts) {
			const key = normalizeSecretKey(draft.key);
			const existing = existingRows.find((row) => normalizeSecretKey(row.key) === key);
			if (existing) {
				const focus = draft.focus ?? "value";
				const canFocus = focus !== "login" || existing.kind === "login";
				firstFocus ??= { rowId: existing.id, focus: canFocus ? focus : "value" };
				continue;
			}

			const row = draftRow({ key, kind: draft.kind, requestId: draft.requestId });
			newRows.push(row);
			firstFocus ??= { rowId: row.id, focus: draft.focus ?? "value" };
		}

		if (newRows.length) prepend(newRows, { shouldFocus: false });
		if (firstFocus) setPendingFocus(firstFocus);
	}, [isLoading, form, prepend]);

	const clearFocusedDraft = useCallback(() => setPendingFocus(null), []);

	return {
		addDraftSecret,
		focusedDraftRowId: pendingFocus?.rowId ?? null,
		focusedDraftField: pendingFocus?.focus ?? null,
		clearFocusedDraft,
	};
};
