import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import t from "@ext/localization/locale/translate";
import type { AlertConfirm } from "@ui-kit/AlertDialog";
import type { ComponentProps } from "react";

export const showGesRequiredModal = () => {
	ModalToOpenService.setValue<ComponentProps<typeof AlertConfirm>>(ModalToOpen.AlertConfirm, {
		title: t("enterprise-catalog-required-title"),
		description: t("enterprise-catalog-required-description"),
		icon: "info",
		status: "warning",
		cancelText: t("ok"),
		onCancel: () => ModalToOpenService.resetValue(),
	});
};
