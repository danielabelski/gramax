import { useDeferApi } from "@core-ui/hooks/useApi";
import type { AgentSecret } from "@ext/agent/mcp/agentSecretStore";
import { useEffect, useState } from "react";

type SecretsListResponse = { secrets: Record<string, AgentSecret> };

let cachedNames: string[] | null = null;
let _pendingFetch: Promise<string[] | null> | null = null;
const listeners = new Set<(names: string[]) => void>();

const notifyListeners = (names: string[]) => {
	cachedNames = names;
	for (const listener of listeners) listener(names);
};

/** Call after a secret is created (e.g. from the "Секреты" toolbar/settings modal) so already-open chats/editors pick it up without a refetch. No-op if the cache hasn't loaded yet — the eventual first fetch will already include it. */
export const addAgentSecretNameToCache = (name: string) => {
	if (!cachedNames || cachedNames.includes(name)) return;
	notifyListeners([...cachedNames, name]);
};

/** Call after a secret is deleted. */
export const removeAgentSecretNameFromCache = (name: string) => {
	if (!cachedNames) return;
	notifyListeners(cachedNames.filter((cachedName) => cachedName !== name));
};

/** Call after a secret is renamed. */
export const renameAgentSecretNameInCache = (oldName: string, newName: string) => {
	if (!cachedNames) return;
	notifyListeners(cachedNames.map((cachedName) => (cachedName === oldName ? newName : cachedName)));
};

/**
 * Shared, fetch-once list of secret NAMES (not values) for matching `${NAME.field}` in displayed text —
 * every consumer (chat messages, skill editor) reads the same cached list instead of triggering its own
 * request, and stays subscribed to it for the lifetime of the component so later additions/renames/deletions
 * (pushed via the functions above) propagate without a page reload. Returns `null` while the first fetch is
 * in flight.
 */
export const useAgentSecretNames = (): string[] | null => {
	const { call: listSecrets } = useDeferApi<SecretsListResponse>({
		url: (api) => api.getAgentSecretsListUrl(),
		opts: { consumeError: true },
	});
	const [names, setNames] = useState<string[] | null>(cachedNames);

	useEffect(() => {
		listeners.add(setNames);

		if (cachedNames) {
			setNames(cachedNames);
		} else {
			_pendingFetch ??= (async () => {
				const data = await listSecrets();
				// useApi swallows request errors (consumeError) and resolves to undefined — don't cache that as
				// "zero secrets", or every later mount would trust the empty cache and never retry.
				if (!data) return null;

				const fetchedNames = Object.keys(data.secrets ?? {});
				notifyListeners(fetchedNames);
				return fetchedNames;
			})().finally(() => {
				_pendingFetch = null;
			});
		}

		return () => {
			listeners.delete(setNames);
		};
	}, [listSecrets]);

	return names;
};
