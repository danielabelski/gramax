import MimeTypes from "@core-ui/ApiServices/Types/MimeTypes";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { downloadFile } from "@core-ui/downloadResource";
import { FloatingAlert } from "@ext/enterprise/components/admin/ui-kit/FloatingAlert";
import { TabInitialLoader } from "@ext/enterprise/components/admin/ui-kit/TabInitialLoader";
import {
	type BillingModeCode,
	type GesCloudAiWallet,
	GesCloudApi,
	type GesCloudSubscription,
	type PaymentChannelCode,
} from "@ext/enterprise-cloud/GesCloudApi";
import { formatCurrency } from "@ext/enterprise-cloud/utils/formatCurrency";
import t from "@ext/localization/locale/translate";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, LoadingButtonTemplate } from "@ui-kit/Button";
import { Dialog, DialogBody, DialogContent } from "@ui-kit/Dialog";
import { Form, FormField, FormHeader, FormStack } from "@ui-kit/Form";
import { Input } from "@ui-kit/Input";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { OfferAcceptanceNotice } from "../../../payModals/paymentModalComponents";
import { RefreshDataButton } from "../../components/RefreshDataButton";
import { StickyHeader } from "../../components/StickyHeader";

const AI_WALLET_TOP_UP_MIN_AMOUNT = 500;

export interface GesCloudAiWalletComponentProps {
	subscription: GesCloudSubscription | null;
}

const GesCloudAiWalletComponent = ({ subscription }: GesCloudAiWalletComponentProps) => {
	const { url: gesCloudUrl } = PageDataContextService.value.conf.enterpriseCloud;
	const gesCloudApi = useMemo(() => new GesCloudApi(gesCloudUrl), [gesCloudUrl]);

	const [wallet, setWallet] = useState<GesCloudAiWallet | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [idempotenceKey, setIdempotenceKey] = useState(() => globalThis.crypto.randomUUID());

	const loadWallet = useCallback(async () => {
		try {
			setIsLoading(true);
			const data = await gesCloudApi.getAiWallet();
			setWallet(data);
		} catch {
			setLoadError(t("enterprise-cloud.org-settings.ai-wallet.load-error"));
		} finally {
			setIsLoading(false);
		}
	}, [gesCloudApi]);

	useEffect(() => {
		void loadWallet();
	}, [loadWallet]);

	const onSucceeded = useCallback(async () => {
		await loadWallet();
	}, [loadWallet]);

	const closeModal = useCallback(() => {
		setIsModalOpen(false);
		setIdempotenceKey(globalThis.crypto.randomUUID());
	}, []);

	if (isLoading) return <TabInitialLoader />;

	return (
		<div className="p-6">
			<StickyHeader
				actions={
					<div className="ml-auto flex items-center gap-2">
						<RefreshDataButton handleRefresh={loadWallet} />

						<Button disabled={!wallet || !subscription} onClick={() => setIsModalOpen(true)}>
							{t("enterprise-cloud.org-settings.ai-wallet.top-up")}
						</Button>
					</div>
				}
				title={t("enterprise-cloud.org-settings.ai-wallet.title")}
			/>

			<FloatingAlert message={loadError} show={Boolean(loadError)} />

			{wallet && (
				<div className="mt-6 flex flex-col gap-1">
					<span className="text-muted-foreground text-sm">
						{t("enterprise-cloud.org-settings.ai-wallet.balance")}
					</span>
					<span className="text-2xl font-semibold">{formatCurrency(wallet.balance, wallet.currency)}</span>
				</div>
			)}

			{wallet && subscription && isModalOpen && (
				<TopUpAiWalletModal
					billingMode={wallet.billingMode}
					currency={wallet.currency}
					gesCloudApi={gesCloudApi}
					hasPaymentMethod={subscription.hasPaymentMethod}
					idempotenceKey={idempotenceKey}
					onClose={closeModal}
					onSucceeded={onSucceeded}
				/>
			)}
		</div>
	);
};

const createTopUpFormSchema = () =>
	z.object({
		amount: z
			.string()
			.trim()
			.refine((value) => Number.isFinite(Number(value)) && Number(value) >= AI_WALLET_TOP_UP_MIN_AMOUNT, {
				message: t("enterprise-cloud.org-settings.ai-wallet.modal.amount-invalid").replace(
					"{minAmount}",
					AI_WALLET_TOP_UP_MIN_AMOUNT,
				),
			}),
	});

type TopUpFormData = z.infer<ReturnType<typeof createTopUpFormSchema>>;

interface TopUpAiWalletModalProps {
	gesCloudApi: GesCloudApi;
	idempotenceKey: string;
	currency: string;
	billingMode: BillingModeCode;
	hasPaymentMethod: boolean;
	onClose: () => void;
	onSucceeded: () => Promise<void> | void;
}

const TopUpAiWalletModal = ({
	gesCloudApi,
	idempotenceKey,
	currency,
	billingMode,
	hasPaymentMethod,
	onClose,
	onSucceeded,
}: TopUpAiWalletModalProps) => {
	const [open, setOpen] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [paymentChannelInProgress, setPaymentChannelInProgress] = useState<PaymentChannelCode | null>(null);

	const onOpenChangeHandler = useCallback(
		(value: boolean) => {
			setOpen(value);
			if (!value) onClose();
		},
		[onClose],
	);

	const form = useForm<TopUpFormData>({
		resolver: zodResolver(createTopUpFormSchema()),
		mode: "onChange",
		defaultValues: { amount: "" },
	});

	const handlePayment = useCallback(
		async (data: TopUpFormData, paymentChannel: PaymentChannelCode) => {
			if (paymentChannelInProgress) return;

			if (Number(data.amount) < AI_WALLET_TOP_UP_MIN_AMOUNT) {
				setError(t("enterprise-cloud.org-settings.ai-wallet.modal.form-error"));
				return;
			}

			setPaymentChannelInProgress(paymentChannel);
			setError(null);
			try {
				const result = await gesCloudApi.topUpAiWallet(idempotenceKey, {
					amount: Number(data.amount),
					currency,
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
					onOpenChangeHandler(false);
					return;
				}

				if (result.status === "succeeded") await onSucceeded();
				onOpenChangeHandler(false);
			} catch {
				setError(t("enterprise-cloud.org-settings.ai-wallet.modal.pay-error"));
				setPaymentChannelInProgress(null);
			}
		},
		[gesCloudApi, idempotenceKey, currency, paymentChannelInProgress, onSucceeded, onOpenChangeHandler],
	);

	const handleTopUp = useCallback(
		async (data: TopUpFormData) => {
			await handlePayment(data, "online_payment");
		},
		[handlePayment],
	);

	const handleCreateInvoice = useCallback(
		() => void form.handleSubmit((data) => handlePayment(data, "bank_transfer"))(),
		[form, handlePayment],
	);

	const handlePayByCard = useCallback(() => void form.handleSubmit(handleTopUp)(), [form, handleTopUp]);

	const isSubmitDisabled = Boolean(paymentChannelInProgress) || !form.formState.isValid;
	const isCreatingInvoice = paymentChannelInProgress === "bank_transfer";
	const isPayingByCard = paymentChannelInProgress === "online_payment";
	const primaryButton =
		billingMode === "legal_entity" ? (
			<div className="flex w-full flex-col gap-2">
				{isCreatingInvoice ? (
					<LoadingButtonTemplate
						className="w-full"
						text={t("enterprise-cloud.org-settings.subscription.payment.create-invoice")}
						variant="outline"
					/>
				) : (
					<Button
						className="w-full"
						disabled={isSubmitDisabled}
						onClick={handleCreateInvoice}
						type="button"
						variant="outline"
					>
						{t("enterprise-cloud.org-settings.subscription.payment.create-invoice")}
					</Button>
				)}
				{isPayingByCard ? (
					<LoadingButtonTemplate
						className="w-full"
						text={t("enterprise-cloud.org-settings.subscription.payment.pay-by-card")}
						variant="outline"
					/>
				) : (
					<Button
						className="w-full"
						disabled={isSubmitDisabled}
						onClick={handlePayByCard}
						type="button"
						variant="outline"
					>
						{t("enterprise-cloud.org-settings.subscription.payment.pay-by-card")}
					</Button>
				)}
			</div>
		) : isPayingByCard ? (
			<LoadingButtonTemplate text={t("enterprise-cloud.org-settings.ai-wallet.modal.pay")} variant="primary" />
		) : (
			<Button disabled={isSubmitDisabled} type="submit">
				{t("enterprise-cloud.org-settings.ai-wallet.modal.pay")}
			</Button>
		);
	const shouldShowBillingNotice = billingMode !== "legal_entity";

	return (
		<Dialog onOpenChange={onOpenChangeHandler} open={open}>
			<DialogContent data-modal-root>
				<Form asChild {...form}>
					<form onSubmit={form.handleSubmit(handleTopUp)}>
						<FormHeader icon="coins" title={t("enterprise-cloud.org-settings.ai-wallet.modal.title")} />
						<DialogBody>
							{error && <div className="mb-3 text-destructive text-sm">{error}</div>}

							<div className="flex flex-col gap-4">
								<FormStack>
									<FormField
										control={({ field }) => (
											<Input
												min={0}
												placeholder={t(
													"enterprise-cloud.org-settings.ai-wallet.modal.amount-placeholder",
												)}
												type="number"
												{...field}
											/>
										)}
										layout="vertical"
										name="amount"
										required
										title={t("enterprise-cloud.org-settings.ai-wallet.modal.amount-label")}
									/>
								</FormStack>
								{primaryButton}
								{shouldShowBillingNotice && (
									<div className="flex flex-col gap-1 text-muted-foreground text-sm">
										{!hasPaymentMethod && (
											<span>
												{t(
													"enterprise-cloud.org-settings.ai-wallet.modal.payment-method-save-notice",
												)}
											</span>
										)}
										<OfferAcceptanceNotice />
									</div>
								)}
							</div>
						</DialogBody>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
};

export default GesCloudAiWalletComponent;
