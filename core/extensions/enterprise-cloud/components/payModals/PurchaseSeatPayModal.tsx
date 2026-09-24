import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import { downloadFile } from "@core-ui/downloadResource";
import type {
	BillingModeCode,
	BillingPeriodCode,
	GesCloudPaymentInfo,
	GesCloudSubscription,
	PaymentChannelCode,
} from "@ext/enterprise-cloud/GesCloudApi";
import { formatCurrency } from "@ext/enterprise-cloud/utils/formatCurrency";
import t from "@ext/localization/locale/translate";
import { zodResolver } from "@hookform/resolvers/zod";
import { Divider } from "@ui-kit/Divider";
import { Form, FormField, FormStack } from "@ui-kit/Form";
import { Input } from "@ui-kit/Input";
import { Skeleton } from "@ui-kit/Skeleton";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
	ButtonWithLoadingState,
	OfferAcceptanceNotice,
	PayModalLayout,
	PaymentInfoLoader,
	Row,
} from "./paymentModalComponents";
import { usePayModalState } from "./usePayModalState";

export interface PurchaseSeatPayModalProps {
	newSeatsCount: number;
	billingPeriod?: BillingPeriodCode;
	billingMode: BillingModeCode;
	subscription: GesCloudSubscription;
	onClose: () => void;
	onSuccess?: () => void;
}

export const PurchaseSeatPayModal = ({
	newSeatsCount,
	billingPeriod,
	billingMode,
	subscription,
	onClose,
	onSuccess,
}: PurchaseSeatPayModalProps) => {
	const formSchema = z.object({
		seatsCount: z
			.number()
			.int()
			.positive()
			.gte(
				newSeatsCount,
				t("enterprise-cloud.org-settings.subscription.payment.not-enough-seats-error").replace(
					"{minSeatsCount}",
					newSeatsCount,
				),
			)
			.step(1),
	});

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		mode: "onChange",
		defaultValues: {
			seatsCount: newSeatsCount,
		},
	});

	const { gesCloudApi, open, error, setError, idempotenceKey, onOpenChangeHandler } = usePayModalState(onClose);
	const [paymentInfo, setPaymentInfo] = useState<GesCloudPaymentInfo | null>(null);
	const [paymentChannelInProgress, setPaymentChannelInProgress] = useState<PaymentChannelCode | null>(null);
	const [loadingState, setLoadingState] = useState<{ isLoading: boolean; seatsCount: number } | null>(null);
	const seatsCount = form.watch("seatsCount");
	const { isValid } = form.formState;

	useEffect(() => {
		const abortController = new AbortController();

		const loadPaymentInfo = async () => {
			setError(null);

			if (isValid) {
				setLoadingState({ isLoading: true, seatsCount });
				try {
					const data = await gesCloudApi.getPrePurchaseSeatsInfo(
						seatsCount,
						billingPeriod,
						abortController.signal,
					);
					setPaymentInfo(data);
				} catch (error) {
					if (!isAbortError(error))
						setError(t("enterprise-cloud.org-settings.subscription.payment.load-error"));
				} finally {
					setLoadingState((prev) => {
						if (prev?.seatsCount === seatsCount) return { isLoading: false, seatsCount };
						return prev;
					});
				}
			}
		};

		void loadPaymentInfo();

		return () => abortController.abort();
	}, [gesCloudApi, isValid, seatsCount, billingPeriod, setError]);

	const onPay = useCallback(
		async (paymentChannel: PaymentChannelCode) => {
			if (paymentChannelInProgress || !isValid) return;

			setPaymentChannelInProgress(paymentChannel);
			setError(null);
			try {
				const result = await gesCloudApi.purchaseSeat(idempotenceKey, {
					totalSeatsCount: seatsCount,
					billingPeriod,
					returnUrl: window.location.href,
					paymentChannel,
				});

				if (result.status === "redirect" && result.redirectUrl) {
					window.location.href = result.redirectUrl;
					return;
				}

				if (result.status === "invoice") {
					const invoice = await gesCloudApi.getInvoicePdf(result.invoiceId);
					downloadFile(invoice.data, MimeTypes.pdf, invoice.fileName);
					onClose();
					return;
				}

				if (result.status === "reserved") onSuccess?.();

				onClose();
			} catch {
				setError(t("enterprise-cloud.org-settings.subscription.payment.pay-error"));
				setPaymentChannelInProgress(null);
			}
		},
		[
			gesCloudApi,
			isValid,
			seatsCount,
			billingPeriod,
			onClose,
			onSuccess,
			idempotenceKey,
			paymentChannelInProgress,
			setError,
		],
	);

	const onCreateInvoice = useCallback(() => void onPay("bank_transfer"), [onPay]);
	const onPayByCard = useCallback(() => void onPay("online_payment"), [onPay]);

	const totalLabel =
		paymentInfo?.billingPeriod === "year"
			? t("enterprise-cloud.org-settings.subscription.payment.total-yearly")
			: t("enterprise-cloud.org-settings.subscription.payment.total-monthly");
	const paymentDisabled =
		!paymentInfo || Boolean(paymentChannelInProgress) || !isValid || Boolean(loadingState?.isLoading);
	const isCreatingInvoice = paymentChannelInProgress === "bank_transfer";
	const isPayingByCard = paymentChannelInProgress === "online_payment";
	const isInitialSubscription = subscription.plan === "free";
	const payButtonText = isInitialSubscription
		? t("enterprise-cloud.org-settings.subscription.payment.pay-and-enable-autorenew")
		: t("enterprise-cloud.org-settings.subscription.payment.pay");

	return (
		<PayModalLayout
			error={error}
			onOpenChange={onOpenChangeHandler}
			open={open}
			title={t("enterprise-cloud.org-settings.subscription.payment.title")}
		>
			{paymentInfo ? (
				<>
					<Form asChild {...form}>
						<form className="contents">
							<FormStack>
								<FormField
									control={({ field }) => (
										<Input
											{...field}
											defaultValue={newSeatsCount}
											min={newSeatsCount}
											onChange={(event) => field.onChange(Number(event.target.value))}
											placeholder={t(
												"enterprise-cloud.org-settings.subscription.payment.set-seats-count-placeholder",
											)}
											step={1}
											type="number"
										/>
									)}
									labelClassName="w-full"
									layout="vertical"
									name="seatsCount"
									required
									title={t("enterprise-cloud.org-settings.subscription.payment.set-seats-count")}
								/>
							</FormStack>
						</form>
					</Form>
					<Divider />
					<div className="flex flex-col gap-2">
						{loadingState?.isLoading ? (
							<Skeleton className="w-full h-5" />
						) : (
							<Row
								label={`${paymentInfo.editorsCount} ${t("enterprise-cloud.org-settings.subscription.payment.seats")}`}
								value={formatCurrency(paymentInfo.paymentPerPeriod, paymentInfo.currency)}
							/>
						)}
						{loadingState?.isLoading ? (
							<Skeleton className="w-full h-5" />
						) : (
							<Row
								bold
								label={totalLabel}
								value={formatCurrency(paymentInfo.paymentPerPeriod, paymentInfo.currency)}
							/>
						)}
					</div>

					<Divider />

					<div className="flex flex-col gap-2">
						<div className="font-semibold text-base">
							{t("enterprise-cloud.org-settings.subscription.payment.due-today-title")}
						</div>
						{loadingState?.isLoading ? (
							<Skeleton className="w-full h-5" />
						) : (
							<Row
								label={t("enterprise-cloud.org-settings.subscription.payment.due-now-seats")}
								value={formatCurrency(paymentInfo.payNowAmount, paymentInfo.currency)}
							/>
						)}
						{loadingState?.isLoading ? (
							<Skeleton className="w-full h-5" />
						) : (
							<Row
								bold
								label={t("enterprise-cloud.org-settings.subscription.payment.due-today")}
								value={formatCurrency(paymentInfo.payNowAmount, paymentInfo.currency)}
							/>
						)}
					</div>
				</>
			) : (
				<PaymentInfoLoader />
			)}

			{billingMode === "legal_entity" ? (
				<div className="flex flex-col gap-2">
					<ButtonWithLoadingState
						disabled={paymentDisabled}
						isLoading={isCreatingInvoice}
						onClick={onCreateInvoice}
						text={t("enterprise-cloud.org-settings.subscription.payment.create-invoice")}
						variant="outline"
					/>
					<ButtonWithLoadingState
						disabled={paymentDisabled}
						isLoading={isPayingByCard}
						onClick={onPayByCard}
						text={t("enterprise-cloud.org-settings.subscription.payment.pay-by-card")}
						variant="outline"
					/>
				</div>
			) : (
				<>
					<ButtonWithLoadingState
						disabled={paymentDisabled}
						isLoading={isPayingByCard}
						onClick={onPayByCard}
						text={payButtonText}
						variant="primary"
					/>
					{paymentInfo && (
						<div className="flex flex-col gap-1 text-muted-foreground text-sm">
							{isInitialSubscription && (
								<span>{t("enterprise-cloud.org-settings.subscription.payment.autorenew-notice")}</span>
							)}
							{!subscription.hasPaymentMethod && (
								<span>
									{t("enterprise-cloud.org-settings.subscription.payment.payment-method-save-notice")}
								</span>
							)}
							<OfferAcceptanceNotice />
						</div>
					)}
				</>
			)}
		</PayModalLayout>
	);
};

const isAbortError = (error: unknown) => error instanceof Error && error.name === "AbortError";
