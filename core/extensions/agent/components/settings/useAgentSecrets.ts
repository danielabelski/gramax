import Method from "@core-ui/ApiServices/Types/Method";
import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import { RequestStatus, useDeferApi } from "@core-ui/hooks/useApi";
import {
	addAgentSecretNameToCache,
	removeAgentSecretNameFromCache,
	renameAgentSecretNameInCache,
} from "@ext/agent/components/utils/secret/useAgentSecretNames";
import type { AgentSecret } from "@ext/agent/mcp/agentSecretStore";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useRef } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { type AgentSecretsFormData, agentSecretsFormSchema, normalizeSecretKey, type SecretRow } from "./secretRow";
import { useAgentSecretDraftFocus } from "./useAgentSecretDraftFocus";

type SecretsListResponse = { secrets: Record<string, AgentSecret> };

const toAgentSecret = (row: Pick<SecretRow, "kind" | "login" | "value" | "url">): AgentSecret => {
	const url = row.url.trim();
	return row.kind === "login"
		? { type: "login", login: row.login, password: row.value, ...(url ? { url } : {}) }
		: { type: "token", token: row.value, ...(url ? { url } : {}) };
};

const areAgentSecretsEqual = (a: AgentSecret | undefined, b: AgentSecret): boolean => {
	if (!a || a.type !== b.type) return false;
	if ((a.url ?? "") !== (b.url ?? "")) return false;
	if (a.type === "login" && b.type === "login") return a.login === b.login && a.password === b.password;
	if (a.type === "token" && b.type === "token") return a.token === b.token;
	return false;
};

/** Untouched row — nothing entered anywhere yet, not worth validating or warning about. */
const isSecretRowBlank = (row: Pick<SecretRow, "key" | "login" | "value" | "url">): boolean =>
	!normalizeSecretKey(row.key) && !row.login.trim() && !row.value && !row.url.trim();

/**
 * Owned by AgentSecretsSection, mounted only while the keys-and-passwords tab is open. A row that
 * can't be committed (empty or duplicate key) never blocks navigation — it just doesn't persist and
 * disappears on unmount; `save`'s unmount safety-net only needs to cover the valid-but-not-yet-blurred
 * case, since an invalid row already returns `false` from `commitSecret` without throwing.
 */
export const useAgentSecrets = () => {
	const form = useForm<AgentSecretsFormData>({
		resolver: zodResolver(agentSecretsFormSchema),
		defaultValues: { rows: [] },
		mode: "onChange",
	});
	const { control } = form;
	// `keyName: "rhfKey"` keeps react-hook-form's own generated array key off of `SecretRow.id` — by
	// default it overwrites a field's `id` with its own generated one, which broke matching a row by id
	// (e.g. for autofocus) since the id callers set was silently replaced.
	const { fields, prepend, remove } = useFieldArray({ control, name: "rows", keyName: "rhfKey" });
	const secrets = useWatch({ control, name: "rows" });
	const commitPromisesRef = useRef(new Map<string, Promise<boolean>>());

	const { status, call: callList } = useDeferApi<SecretsListResponse>({
		url: (api) => api.getAgentSecretsListUrl(true),
		opts: { consumeError: true },
		onDone: (data) =>
			form.reset({
				rows: Object.entries(data?.secrets ?? {})
					.reverse()
					.map(([key, secret]) => ({
						id: crypto.randomUUID(),
						key,
						savedKey: key,
						savedSecret: secret,
						value: secret.token ?? secret.password ?? "",
						kind: secret.type,
						login: secret.login ?? "",
						url: secret.url ?? "",
					})),
			}),
	});
	const isLoading = status === RequestStatus.Init || status === RequestStatus.Loading;

	// biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
	useEffect(() => {
		void callList();
	}, []);

	const { call: callSet } = useDeferApi<{ ok: true }>({
		url: (api) => api.getAgentSecretsSetUrl(),
		opts: { method: Method.POST, mime: MimeTypes.json, consumeError: true },
	});

	const { call: callUpdate } = useDeferApi<{ ok: true }>({
		url: (api) => api.getAgentSecretsUpdateUrl(),
		opts: { method: Method.POST, mime: MimeTypes.json, consumeError: true },
	});

	const { call: callDelete } = useDeferApi<unknown>({ opts: { consumeError: true } });

	const { addDraftSecret, focusedDraftRowId, focusedDraftField, clearFocusedDraft } = useAgentSecretDraftFocus({
		form,
		prepend,
		isLoading,
	});

	const commitSecret = useCallback(
		async (index: number) => {
			const rowId = form.getValues(`rows.${index}.id`);
			if (!rowId) return true;

			const pendingCommit = commitPromisesRef.current.get(rowId);
			if (pendingCommit) return pendingCommit;

			const commitPromise = (async () => {
				const rows = form.getValues("rows");
				const rowIndex = rows.findIndex((r) => r.id === rowId);
				const row = rows[rowIndex];
				if (!row) return true;

				if (isSecretRowBlank(row)) return true;

				// `key` is the only field with any zod rule (required + cross-row duplicate) on
				// secretRowSchema, and it must be the exact leaf path: react-hook-form's resolver
				// return value correctly reflects invalidity for an object-level path like
				// `rows.${rowIndex}`, but doesn't propagate that result into the field's own
				// fieldState unless the leaf itself (or no path at all) is triggered — so a row-level
				// trigger silently left the duplicate-key tooltip closed until some later interaction
				// happened to validate the key directly.
				const isValid = await form.trigger(`rows.${rowIndex}.key`);
				if (!isValid) return false;

				const key = normalizeSecretKey(row.key);
				const oldKey = row.savedKey;
				const secret = toAgentSecret(row);

				if (key === oldKey && areAgentSecretsEqual(row.savedSecret, secret)) return true;

				if (key !== oldKey) {
					if (oldKey) {
						const result = await callUpdate({
							opts: { body: JSON.stringify({ oldKey, key, secret }) },
						});
						if (!result) return false;
						renameAgentSecretNameInCache(oldKey, key);
					} else {
						const result = await callSet({ opts: { body: JSON.stringify({ key, secret }) } });
						if (!result) return false;
						addAgentSecretNameToCache(key);
					}

					const currentIndex = form.getValues("rows").findIndex((r) => r.id === rowId);
					if (currentIndex === -1) return true;
					form.setValue(`rows.${currentIndex}.key`, key);
					form.setValue(`rows.${currentIndex}.savedKey`, key);
					form.setValue(`rows.${currentIndex}.savedSecret`, secret);
					return true;
				}

				const result = await callSet({ opts: { body: JSON.stringify({ key, secret }) } });
				if (result) {
					const currentIndex = form.getValues("rows").findIndex((r) => r.id === rowId);
					if (currentIndex !== -1) form.setValue(`rows.${currentIndex}.savedSecret`, secret);
				}
				return Boolean(result);
			})();

			commitPromisesRef.current.set(rowId, commitPromise);
			try {
				return await commitPromise;
			} finally {
				commitPromisesRef.current.delete(rowId);
			}
		},
		[form, callUpdate, callSet],
	);

	const commitAllSecrets = useCallback(async () => {
		const rows = form.getValues("rows");
		let allCommitted = true;
		for (const [_row, index] of rows.map((row, index) => [row, index] as const)) {
			const committed = await commitSecret(index);
			if (!committed) allCommitted = false;
		}
		return allCommitted;
	}, [form, commitSecret]);

	const deleteSecret = useCallback(
		(index: number) => {
			const row = form.getValues(`rows.${index}`);
			remove(index);
			if (row?.savedKey) {
				void callDelete({ url: (api) => api.getAgentSecretsDeleteUrl(row.savedKey) });
				removeAgentSecretNameFromCache(row.savedKey);
			}
		},
		[form, remove, callDelete],
	);

	const save = useCallback(async () => {
		const allCommitted = await commitAllSecrets();
		if (!allCommitted) throw new Error("Some keys or passwords could not be saved");
	}, [commitAllSecrets]);

	return {
		form,
		fields,
		secrets,
		isLoading,
		addDraftSecret,
		commitSecret,
		deleteSecret,
		focusedDraftRowId,
		focusedDraftField,
		clearFocusedDraft,
		save,
	};
};
