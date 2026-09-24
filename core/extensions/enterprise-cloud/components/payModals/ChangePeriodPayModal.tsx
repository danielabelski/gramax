import type { GesCloudChangePeriodPaymentInfo } from "@ext/enterprise-cloud/GesCloudApi";
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

export interface ChangePeriodPayModalProps {
	onClose: () => void;
	onSuccess?: () => void;
}

export const ChangePeriodPayModal = ({ onClose, onSuccess }: ChangePeriodPayModalProps) => {
	const { gesCloudApi, open, error, setError, idempotenceKey, onOpenChangeHandler } = usePayModalState(onClose);
	const [paymentInfo, setPaymentInfo] = useState<GesCloudChangePeriodPaymentInfo | null>(null);
	const [paying, setPaying] = useState(false);

	useEffect(() => {
		const loadPaymentInfo = async () => {
			try {
				const data = await gesCloudApi.getChangePeriodPaymentInfo();
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
			const result = await gesCloudApi.changeBillingPeriod(idempotenceKey, {
				returnUrl: window.location.href,
			});

			if (result.status === "reserved") onSuccess?.();

			onClose();
		} catch {
			setError(t("enterprise-cloud.org-settings.subscription.payment.pay-error"));
			setPaying(false);
		}
	}, [gesCloudApi, onClose, onSuccess, idempotenceKey, setError]);

	const title = t("enterprise-cloud.org-settings.subscription.payment.change-period-title");

	return (
		<PayModalLayout error={error} onOpenChange={onOpenChangeHandler} open={open} title={title}>
			{paymentInfo ? (
				<>
					<div className="flex flex-col gap-2">
						<Row
							label={t("enterprise-cloud.org-settings.subscription.payment.per-editor-yearly")}
							value={formatCurrency(paymentInfo.pricePerEditorPerPeriod, paymentInfo.currency)}
						/>
						<Row
							label={`${paymentInfo.editorsCount} ${t("enterprise-cloud.org-settings.subscription.payment.seats")}`}
							value={formatCurrency(paymentInfo.paymentPerPeriod, paymentInfo.currency)}
						/>
						<Row
							bold
							label={t("enterprise-cloud.org-settings.subscription.payment.total-yearly")}
							value={formatCurrency(paymentInfo.paymentPerPeriod, paymentInfo.currency)}
						/>
					</div>

					<Divider />

					<div className="flex flex-col gap-2">
						<div className="font-semibold text-base">
							{t("enterprise-cloud.org-settings.subscription.payment.due-today-title")}
						</div>
						<Row
							label={t("enterprise-cloud.org-settings.subscription.payment.unused-days-credit")}
							value={`-${formatCurrency(paymentInfo.prorationCredit, paymentInfo.currency)}`}
						/>
						<Row
							bold
							label={t("enterprise-cloud.org-settings.subscription.payment.due-today")}
							value={formatCurrency(paymentInfo.payNowAmount, paymentInfo.currency)}
						/>
					</div>
				</>
			) : (
				<PaymentInfoLoader />
			)}

			<ButtonWithLoadingState
				disabled={!paymentInfo || Boolean(error)}
				isLoading={paying}
				loadingText={title}
				onClick={onPay}
				text={t("enterprise-cloud.org-settings.subscription.payment.pay")}
				variant="primary"
			/>
			{paymentInfo && <OfferAcceptanceNotice />}
		</PayModalLayout>
	);
};
