import { RequestStatus, useDeferApi } from "@core-ui/hooks/useApi";
import type { AgentSecret } from "@ext/agent/mcp/agentSecretStore";
import { useEffect, useMemo } from "react";

type SecretsListResponse = { secrets: Record<string, AgentSecret> };

export type AgentSecretSummary = { key: string; kind: AgentSecret["type"] };

export const useAgentSecretsSummary = (): { secrets: AgentSecretSummary[]; isLoading: boolean } => {
	const {
		status,
		data,
		call: callList,
	} = useDeferApi<SecretsListResponse>({
		url: (api) => api.getAgentSecretsListUrl(),
		opts: { consumeError: true },
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
	useEffect(() => {
		void callList();
	}, []);

	const secrets = useMemo<AgentSecretSummary[]>(
		() => Object.entries(data?.secrets ?? {}).map(([key, secret]) => ({ key, kind: secret.type })),
		[data],
	);

	return { secrets, isLoading: status === RequestStatus.Init || status === RequestStatus.Loading };
};
