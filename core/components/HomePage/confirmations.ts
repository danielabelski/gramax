import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import t from "@ext/localization/locale/translate";
import type { AlertConfirm } from "@ui-kit/AlertDialog";
import type { ComponentProps } from "react";

interface ConfirmationTexts {
	title: string;
	description: string;
	cancelText: string;
	confirmText: string;
}

const confirm = async ({ title, description, cancelText, confirmText }: ConfirmationTexts) => {
	const result = await new Promise<boolean>((resolve) => {
		if (ModalToOpenService.hasValue()) {
			resolve(false);
			return;
		}

		ModalToOpenService.setValue<ComponentProps<typeof AlertConfirm>>(ModalToOpen.AlertConfirm, {
			title,
			description,
			cancelText,
			confirmText,
			status: "warning",
			icon: "triangle-alert",
			onConfirm: () => {
				resolve(true);
				ModalToOpenService.resetValue();
			},
			onCancel: () => {
				resolve(false);
				ModalToOpenService.resetValue();
			},
		});
	});

	return result;
};

export const confirmEmptySections = () =>
	confirm({
		title: t("confirmation.empty-sections-on-save.title"),
		description: t("confirmation.empty-sections-on-save.body"),
		cancelText: t("confirmation.empty-sections-on-save.buttons.secondary"),
		confirmText: t("confirmation.empty-sections-on-save.buttons.primary"),
	});

export const confirmDiscardChanges = () =>
	confirm({
		title: t("confirmation.discard-homepage-changes.title"),
		description: t("confirmation.discard-homepage-changes.body"),
		cancelText: t("confirmation.discard-homepage-changes.buttons.secondary"),
		confirmText: t("confirmation.discard-homepage-changes.buttons.primary"),
	});

export const confirmLeaveEditMode = () =>
	confirm({
		title: t("confirmation.leave-edit-mode.title"),
		description: t("confirmation.leave-edit-mode.body"),
		cancelText: t("confirmation.leave-edit-mode.buttons.secondary"),
		confirmText: t("confirmation.leave-edit-mode.buttons.primary"),
	});

export const confirmConvertSectionToFolder = () =>
	confirm({
		title: t("confirmation.convert-section-with-folders.title"),
		description: t("confirmation.convert-section-with-folders.body"),
		cancelText: t("confirmation.convert-section-with-folders.buttons.secondary"),
		confirmText: t("confirmation.convert-section-with-folders.buttons.primary"),
	});

export const confirmHomepageDelete = (target: "section" | "folder") =>
	confirm({
		title: t(`confirmation.delete-homepage-${target}.title`),
		description: t(`confirmation.delete-homepage-${target}.body`),
		cancelText: t("cancel"),
		confirmText: t("delete"),
	});
