import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import t from "@ext/localization/locale/translate";
import { Button } from "@ui-kit/Button";
import { Dialog, DialogBody, DialogContent } from "@ui-kit/Dialog";
import { FormHeader } from "@ui-kit/Form";
import { type ComponentProps, useCallback, useState } from "react";
import type { LegalEntitySwitchModal } from "../billing/LegalEntitySwitchModal";

interface PayerTypeChooseModalProps {
	onClose: () => void;
	onIndividualContinue: () => Promise<void> | void;
	onLegalEntitySuccess?: () => Promise<void> | void;
}

export const PayerTypeChooseModal = ({
	onClose,
	onIndividualContinue,
	onLegalEntitySuccess,
}: PayerTypeChooseModalProps) => {
	const [open, setOpen] = useState(true);

	const onOpenChangeHandler = useCallback(
		(value: boolean) => {
			setOpen(value);
			if (!value) onClose();
		},
		[onClose],
	);

	const handleIndividualClick = useCallback(() => {
		onOpenChangeHandler(false);
		void onIndividualContinue();
	}, [onIndividualContinue, onOpenChangeHandler]);

	const handleLegalEntityClick = useCallback(() => {
		onOpenChangeHandler(false);

		const modalId = ModalToOpenService.addModal<ComponentProps<typeof LegalEntitySwitchModal>>(
			ModalToOpen.GesCloudLegalEntitySwitch,
			{
				title: t("enterprise-cloud.org-settings.subscription.payer-type.legal-entity-title"),
				submitLabel: t("enterprise-cloud.org-settings.subscription.payer-type.legal-entity-submit"),
				onSuccess: onLegalEntitySuccess,
				onClose: () => ModalToOpenService.removeModal(modalId),
			},
		);
	}, [onLegalEntitySuccess, onOpenChangeHandler]);

	return (
		<Dialog onOpenChange={onOpenChangeHandler} open={open}>
			<DialogContent data-modal-root>
				<FormHeader
					description={t("enterprise-cloud.org-settings.subscription.payer-type.description")}
					icon="credit-card"
					title={t("enterprise-cloud.org-settings.subscription.payer-type.title")}
				/>
				<DialogBody>
					<div className="flex flex-col gap-3">
						<PayerTypeButton
							description={t(
								"enterprise-cloud.org-settings.subscription.payer-type.individual-description",
							)}
							icon="user"
							onClick={handleIndividualClick}
							title={t("enterprise-cloud.org-settings.subscription.payer-type.individual")}
						/>
						<PayerTypeButton
							description={t(
								"enterprise-cloud.org-settings.subscription.payer-type.legal-entity-description",
							)}
							icon="building2"
							onClick={handleLegalEntityClick}
							title={t("enterprise-cloud.org-settings.subscription.payer-type.legal-entity")}
						/>
					</div>
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
};

interface PayerTypeButtonProps {
	title: string;
	description: string;
	icon: "building2" | "user";
	onClick: () => void;
}

const PayerTypeButton = ({ title, description, icon, onClick }: PayerTypeButtonProps) => (
	<Button className="h-auto w-full justify-start p-4 text-left" onClick={onClick} startIcon={icon} variant="outline">
		<span className="flex flex-col gap-1">
			<span className="font-medium">{title}</span>
			<span className="font-normal text-muted-foreground text-sm">{description}</span>
		</span>
	</Button>
);
