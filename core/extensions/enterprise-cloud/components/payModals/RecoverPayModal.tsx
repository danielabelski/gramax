import type { GesCloudRecoverPaymentInfo } from "@ext/enterprise-cloud/GesCloudApi";
import { formatCurrency } from "@ext/enterprise-cloud/utils/formatCurrency";
import t from "@ext/localization/locale/translate";
import { Divider } from "@ui-kit/Divider";
import { useCallback, useEffect, useState } from "react";
import {
	ButtonWithLoadingState,
	OfferAcceptanceNotice,
	PayModalLayout,
	PaymentInfoLoader,
	Row,
} from "./paymentModalComponents";
import { usePayModalState } from "./usePayModalState";

export interface RecoverPayModalProps {
	onClose: () => void;
	onSuccess?: () => void;
}

export const RecoverPayModal = ({ onClose, onSuccess }: RecoverPayModalProps) => {
	const { gesCloudApi, open, error, setError, idempotenceKey, onOpenChangeHandler } = usePayModalState(onClose);
	const [paymentInfo, setPaymentInfo] = useState<GesCloudRecoverPaymentInfo | null>(null);
	const [paying, setPaying] = useState(false);

	useEffect(() => {
		const loadPaymentInfo = async () => {
			try {
				const data = await gesCloudApi.getRecoverPaymentInfo();
				setPaymentInfo(data);
			} catch {
				setError(t("enterprise-cloud.org-settings.subscription.payment.load-error"));
			}
		};

		void loadPaymentInfo();
	}, [gesCloudApi, setError]);

	const onPay = useCallback(async () => {
		setPaying(true);
		setError(null);
		try {
			await gesCloudApi.recoverFromSuspended(idempotenceKey);
			onSuccess?.();
			onClose();
		} catch {
			setError(t("enterprise-cloud.org-settings.subscription.payment.pay-error"));
			setPaying(false);
		}
	}, [gesCloudApi, onClose, onSuccess, idempotenceKey, setError]);

	const title = t("enterprise-cloud.org-settings.subscription.payment.recover-title");
	const isResetToFree = paymentInfo?.type === "resetToFree";
	const totalLabel =
		paymentInfo?.type === "recoverPaid" && paymentInfo.billingPeriod === "year"
			? t("enterprise-cloud.org-settings.subscription.payment.total-yearly")
			: t("enterprise-cloud.org-settings.subscription.payment.total-monthly");
	const payButtonLabel = isResetToFree
		? t("enterprise-cloud.org-settings.subscription.payment.recover-confirm")
		: t("enterprise-cloud.org-settings.subscription.payment.pay");

	return (
		<PayModalLayout error={error} onOpenChange={onOpenChangeHandler} open={open} title={title}>
			{paymentInfo ? (
				paymentInfo.type === "resetToFree" ? (
					<div className="text-sm">
						{t("enterprise-cloud.org-settings.subscription.payment.reset-to-free-message")}
					</div>
				) : (
					<>
						<div className="flex flex-col gap-2">
							<Row
								label={`${paymentInfo.editorsCount} ${t("enterprise-cloud.org-settings.subscription.payment.seats")}`}
								value={formatCurrency(paymentInfo.paymentPerPeriod, paymentInfo.currency)}
							/>
							<Row
								bold
								label={totalLabel}
								value={formatCurrency(paymentInfo.paymentPerPeriod, paymentInfo.currency)}
							/>
						</div>

						<Divider />

						<div className="flex flex-col gap-2">
							<div className="font-semibold text-base">
								{t("enterprise-cloud.org-settings.subscription.payment.due-today-title")}
							</div>
							<Row
								bold
								label={t("enterprise-cloud.org-settings.subscription.payment.due-today")}
								value={formatCurrency(paymentInfo.payNowAmount, paymentInfo.currency)}
							/>
						</div>
					</>
				)
			) : (
				<PaymentInfoLoader />
			)}

			<ButtonWithLoadingState
				disabled={!paymentInfo || Boolean(error)}
				isLoading={paying}
				loadingText={title}
				onClick={onPay}
				text={payButtonLabel}
				variant="primary"
			/>
			{paymentInfo && !isResetToFree && <OfferAcceptanceNotice />}
		</PayModalLayout>
	);
};
