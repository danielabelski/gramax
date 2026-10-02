import t from "@ext/localization/locale/translate";
import { Alert, AlertButton, AlertDescription, AlertIcon, AlertTitle } from "@ui-kit/Alert";
import type { MissingSecretWarning as MissingSecretWarningViewModel } from "../getMissingSecretsFromToolResult";
import { useMissingSecretWarning } from "./useMissingSecretWarning";

export interface MissingSecretWarningProps {
	warning: MissingSecretWarningViewModel;
}

export const MissingSecretWarning = ({ warning }: MissingSecretWarningProps) => {
	const { title, description, handleAddSecrets } = useMissingSecretWarning(warning.secrets);

	return (
		<Alert className="my-2 px-3.5 min-w-0" focus="low" status="warning">
			<AlertIcon icon="triangle-alert" />
			<AlertTitle className="font-normal line-clamp-3">{title}</AlertTitle>
			<AlertDescription className="text-secondary-fg">{description}</AlertDescription>
			<AlertButton className="font-normal" onClick={handleAddSecrets} variant="text">
				{t("agent.missing-secret.button")}
			</AlertButton>
		</Alert>
	);
};
