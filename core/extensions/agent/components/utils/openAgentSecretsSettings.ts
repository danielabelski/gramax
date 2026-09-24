import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import type GesCloudAppSettingsEditor from "@ext/enterprise-cloud/components/GesCloudAppSettingsEditor";
import type AppSettingsEditor from "@ext/settings/components/AppSettingsEditor";
import { Level } from "@ext/settings/logic/settings";
import type { ComponentProps } from "react";

/** Opens the settings modal on the keys-and-passwords tab — the cloud one when running in the cloud. */
export const openAgentSecretsSettings = (isCloud = false): void => {
	const props = {
		defaultLevel: Level.app,
		defaultAppTab: "keys-passwords" as const,
		onClose: () => ModalToOpenService.resetValue(),
	};

	if (isCloud) {
		ModalToOpenService.setValue<ComponentProps<typeof GesCloudAppSettingsEditor>>(
			ModalToOpen.GesAppSettings,
			props,
		);
		return;
	}

	ModalToOpenService.setValue<ComponentProps<typeof AppSettingsEditor>>(ModalToOpen.AppSettings, props);
};
