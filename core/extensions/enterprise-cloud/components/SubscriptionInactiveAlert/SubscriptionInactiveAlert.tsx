import t from "@ext/localization/locale/translate";
import { Alert, AlertButton, AlertDescription, AlertIcon, AlertTitle } from "@ui-kit/Alert";
import { type ComponentProps, useCallback } from "react";
import ModalToOpenService from "../../../../ui-logic/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "../../../../ui-logic/ContextServices/ModalToOpenService/model/ModalsToOpen";
import type { SubscriptionStatusCode } from "../../GesCloudApi";
import type { RecoverPayModal } from "../payModals/RecoverPayModal";

interface SubscriptionInactiveAlertProps {
	subscriptionInfo: { status: SubscriptionStatusCode };
}

export const SubscriptionInactiveAlert = ({ subscriptionInfo }: SubscriptionInactiveAlertProps) => {
	const className = "mb-3";

	if (subscriptionInfo.status === "past_due") return <PastDueAlert className={className} />;
	if (subscriptionInfo.status === "suspended") return <SuspendedAlert className={className} />;

	return null;
};

const PastDueAlert = ({ className }: { className?: string }) => {
	return (
		<Alert className={className} focus="high" status="warning">
			<AlertIcon icon={"alert-triangle"} />
			<AlertTitle>{t("enterprise-cloud.subscription-inactive-alert.title.past_due")}</AlertTitle>
			<AlertDescription>
				{t("enterprise-cloud.subscription-inactive-alert.description.past_due")}
			</AlertDescription>
		</Alert>
	);
};

const SuspendedAlert = ({ className }: { className?: string }) => {
	const handler = useCallback(() => {
		const modalId = ModalToOpenService.addModal<ComponentProps<typeof RecoverPayModal>>(
			ModalToOpen.GesCloudRecoverPaymentInfo,
			{
				onClose: () => ModalToOpenService.removeModal(modalId),
				onSuccess: () => {},
			},
		);
	}, []);

	return (
		<>
			<Alert className={className} focus="high" status="warning">
				<AlertIcon icon={"alert-triangle"} />
				<AlertTitle>{t("enterprise-cloud.subscription-inactive-alert.title.suspended")}</AlertTitle>
				<AlertDescription>
					{t("enterprise-cloud.subscription-inactive-alert.description.suspended")}
				</AlertDescription>
				<AlertButton onClick={handler}>
					{t("enterprise-cloud.subscription-inactive-alert.buttons.pay")}
				</AlertButton>
			</Alert>
		</>
	);
};
