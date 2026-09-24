import { useAgentSecretDraftStore } from "@ext/agent/components/store/AgentSecretDraftStore";
import { openAgentSecretsSettings } from "@ext/agent/components/utils/openAgentSecretsSettings";
import { parseSecretDraft } from "@ext/agent/components/utils/secret/secretDraft";
import t from "@ext/localization/locale/translate";
import { Alert, AlertButton, AlertDescription, AlertIcon, AlertTitle } from "@ui-kit/Alert";
import { useMemo } from "react";
import type { MissingSecretWarning as MissingSecretWarningViewModel } from "../getMissingSecretsFromToolResult";

export interface MissingSecretWarningProps {
	warning: MissingSecretWarningViewModel;
}

export const MissingSecretWarning = ({ warning }: MissingSecretWarningProps) => {
	const { secrets } = warning;
	// `warning`/`secrets` gets a new array reference on most re-renders while this card streams in
	// chat (the parent's own memo is keyed on the whole response list), even though the actual set of
	// missing secret names is usually unchanged — key on content, not reference, so a same-content
	// re-render skips reparsing every secret name.
	const secretsKey = secrets.join("|");
	// Title and Add follow the first credential key. `url` is on both kinds, so if that key also
	// has login/password/token missing, use that field — otherwise one missing login reads as a token.
	// Count distinct keys, not raw names, so one login doesn't read as "several".
	// biome-ignore lint/correctness/useExhaustiveDependencies: secretsKey mirrors secrets' content, secrets itself is a fresh array most renders
	const { firstDraft, isMultiple } = useMemo(() => {
		const drafts = secrets.map(parseSecretDraft);
		const key = drafts[0]?.key;
		return {
			firstDraft: drafts.find((draft) => draft.key === key && draft.focus !== "url") ?? drafts[0] ?? null,
			isMultiple: new Set(drafts.map((draft) => draft.key)).size > 1,
		};
	}, [secretsKey]);
	const kind = firstDraft?.kind ?? "token";

	const title = t(`agent.missing-secret.title-${kind}`);
	const description = t(
		isMultiple ? "agent.missing-secret.description-many" : "agent.missing-secret.description-one",
	);

	const handleAddToken = () => {
		if (!firstDraft) return;
		useAgentSecretDraftStore.getState().setPendingDraft(firstDraft);
		openAgentSecretsSettings();
	};

	return (
		<Alert className="my-2 px-3.5" focus="low" status="warning">
			<AlertIcon icon="triangle-alert" />
			<AlertTitle className="font-normal">{title}</AlertTitle>
			<AlertDescription className="text-secondary-fg">{description}</AlertDescription>
			<AlertButton className="font-normal" onClick={handleAddToken} variant="text">
				{t("agent.missing-secret.button")}
			</AlertButton>
		</Alert>
	);
};
