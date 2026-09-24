import t from "@ext/localization/locale/translate";
import { customToast, Toast } from "@ui-kit/Toast";

export const showPluginCompatibilityToast = (pluginName: string) =>
	customToast(({ id, toast }) => (
		<Toast
			closeAction
			description={t("plugins.messages.sdk-incompatible-description")}
			id={id as number}
			onClose={() => toast.dismiss(id)}
			status="error"
			title={t("plugins.messages.sdk-incompatible-title").replace("{name}", pluginName)}
		/>
	));
