import DateComponent from "@components/Atoms/Date";
import ModalToOpenService from "@core-ui/ContextServices/ModalToOpenService/ModalToOpenService";
import ModalToOpen from "@core-ui/ContextServices/ModalToOpenService/model/ModalsToOpen";
import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { FloatingAlert } from "@ext/enterprise/components/admin/ui-kit/FloatingAlert";
import { TabInitialLoader } from "@ext/enterprise/components/admin/ui-kit/TabInitialLoader";
import { TableComponent } from "@ext/enterprise/components/admin/ui-kit/table/TableComponent";
import { GesCloudApi, type GesCloudPayment, type GesCloudSubscription } from "@ext/enterprise-cloud/GesCloudApi";
import { formatCurrency } from "@ext/enterprise-cloud/utils/formatCurrency";
import t from "@ext/localization/locale/translate";
import { Button } from "@ui-kit/Button";
import { getCoreRowModel, useReactTable } from "@ui-kit/DataTable";
import { Divider } from "@ui-kit/Divider";
import { IconTooltip } from "@ui-kit/IconTooltip";
import { type ComponentProps, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import type { ChangePeriodPayModal } from "../../../payModals/ChangePeriodPayModal";
import { SubscriptionInactiveAlert } from "../../../SubscriptionInactiveAlert/SubscriptionInactiveAlert";
import { RefreshDataButton } from "../../components/RefreshDataButton";
import { StickyHeader } from "../../components/StickyHeader";
import type { CancelSubscriptionModal } from "../components/CancelSubscriptionModal";
import type { TariffChooseModal } from "../components/TariffChooseModal";
import { getGesCloudPaymentsTableColumns } from "./config/GesCloudPaymentsTableConfig";

export type GesCloudBillingComponentProps = {
	subscription: GesCloudSubscription | null;
	refreshSubscription: () => void;
};

const GesCloudBillingComponent = ({ subscription, refreshSubscription }: GesCloudBillingComponentProps) => {
	const { url: gesCloudUrl } = PageDataContextService.value.conf.enterpriseCloud;
	const gesCloudApi = useMemo(() => new GesCloudApi(gesCloudUrl), [gesCloudUrl]);

	const [payments, setPayments] = useState<GesCloudPayment[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);

	const refreshData = useCallback(async () => {
		try {
			setIsLoading(true);
			const [, paymentsData] = await Promise.all([refreshSubscription(), gesCloudApi.getPayments()]);
			setPayments(paymentsData);
		} catch {
			setLoadError(t("enterprise-cloud.org-settings.billing.load-error"));
		} finally {
			setIsLoading(false);
		}
	}, [gesCloudApi, refreshSubscription]);

	useEffect(() => {
		void refreshData();
	}, [refreshData]);

	const openChangePeriodModal = useCallback(() => {
		const modalId = ModalToOpenService.addModal<ComponentProps<typeof ChangePeriodPayModal>>(
			ModalToOpen.GesCloudChangePeriod,
			{
				onSuccess: refreshData,
				onClose: () => ModalToOpenService.removeModal(modalId),
			},
		);
	}, [refreshData]);

	const openCancelSubscriptionModal = useCallback(() => {
		const modalId = ModalToOpenService.addModal<ComponentProps<typeof CancelSubscriptionModal>>(
			ModalToOpen.CancelSubscription,
			{
				currentPeriodEnd: subscription?.currentPeriodEnd,
				freeSeatsLimit: subscription?.seatsInfo.freeSeatsLimit,
				occupiedSeats: subscription?.seatsInfo.occupiedSeats,
				onClose: () => ModalToOpenService.removeModal(modalId),
				onConfirm: refreshData,
			},
		);
	}, [subscription, refreshData]);

	const openTariffChooseModal = useCallback(() => {
		const modalId = ModalToOpenService.addModal<ComponentProps<typeof TariffChooseModal>>(
			ModalToOpen.TariffChoose,
			{
				currentBillingPeriod: subscription?.billingPeriod ?? undefined,
				onContinue: (billingPeriod) => {
					if (billingPeriod === "year") openChangePeriodModal();
				},
				onClose: () => ModalToOpenService.removeModal(modalId),
			},
		);
	}, [subscription, openChangePeriodModal]);

	const columns = useMemo(() => getGesCloudPaymentsTableColumns(), []);

	const table = useReactTable({
		data: payments,
		columns,
		getCoreRowModel: getCoreRowModel(),
	});

	const isPaid = subscription?.plan === "paid";
	const canChangePlan = isPaid;

	const planLabel = useMemo(() => {
		if (!subscription) return "";
		if (!isPaid) return t("enterprise-cloud.org-settings.billing.plan-free");

		const periodLabel =
			subscription.billingPeriod === "year"
				? t("enterprise-cloud.org-settings.billing.period-year")
				: t("enterprise-cloud.org-settings.billing.period-month");

		return `${t("enterprise-cloud.org-settings.billing.plan-paid")} · ${periodLabel}`;
	}, [subscription, isPaid]);

	const typeLabel = useMemo(() => {
		if (!subscription) return "";
		if (subscription.billingMode === "individual")
			return t("enterprise-cloud.org-settings.billing.type.individual");
		if (subscription.billingMode === "legal_entity")
			return t("enterprise-cloud.org-settings.billing.type.corporate");
		return "";
	}, [subscription]);

	if (isLoading) return <TabInitialLoader />;

	return (
		<div className="p-6">
			<StickyHeader
				actions={
					<div className="flex flex-wrap gap-2">
						{canChangePlan && (
							<Button onClick={openTariffChooseModal}>
								{t("enterprise-cloud.org-settings.billing.change-plan")}
							</Button>
						)}
						{isPaid && !subscription.cancelScheduledAt && (
							<Button onClick={openCancelSubscriptionModal} status="error" variant="outline">
								{t("enterprise-cloud.org-settings.billing.cancel-subscription.open")}
							</Button>
						)}
					</div>
				}
				title={t("enterprise-cloud.org-settings.billing.title")}
			/>

			{subscription && <SubscriptionInactiveAlert subscriptionInfo={subscription} />}
			<FloatingAlert message={loadError} show={Boolean(loadError)} />

			{subscription && (
				<div className="mt-6">
					<div className="mb-4 font-semibold text-lg">
						{t("enterprise-cloud.org-settings.billing.your-plan")}
					</div>
					<div className="flex flex-wrap gap-x-16 gap-y-6 justify-between">
						<StatBlock label={t("enterprise-cloud.org-settings.billing.current-plan")} value={planLabel} />
						<StatBlock label={t("enterprise-cloud.org-settings.billing.type.name")} value={typeLabel} />
						<StatBlock
							label={t("enterprise-cloud.org-settings.billing.available-seats")}
							value={String(subscription.seatsInfo.maxSeats)}
						/>
						<StatBlock
							label={t("enterprise-cloud.org-settings.billing.next-charge-date")}
							value={
								isPaid && subscription.nextChargeAt ? (
									<DateComponent date={new Date(subscription.nextChargeAt)} />
								) : (
									"—"
								)
							}
						/>
						<StatBlock
							label={t("enterprise-cloud.org-settings.billing.next-charge-amount")}
							value={
								isPaid ? (
									subscription.willBecomeFree ? (
										<span className="flex items-center gap-1">
											{formatCurrency("0", subscription.currency)}
											<IconTooltip
												content={t(
													"enterprise-cloud.org-settings.billing.will-become-free-tooltip",
												).replace(
													"{freeSeatsLimit}",
													subscription.seatsInfo.freeSeatsLimit.toString(),
												)}
												icon="help-circle"
											/>
										</span>
									) : (
										formatCurrency(subscription.nextChargeAmount, subscription.currency)
									)
								) : (
									"—"
								)
							}
						/>
					</div>
				</div>
			)}

			<Divider className="my-6" />

			<div className="flex flex-wrap gap-2 items-center mb-3">
				<div className="font-medium text-lg">{t("enterprise-cloud.org-settings.billing.payments.title")}</div>
				<RefreshDataButton handleRefresh={refreshData} />
			</div>

			{payments.length === 0 ? (
				<div className="text-muted-foreground text-sm">
					{t("enterprise-cloud.org-settings.billing.payments.empty")}
				</div>
			) : (
				<TableComponent<GesCloudPayment> columns={columns} table={table} />
			)}
		</div>
	);
};

interface StatBlockProps {
	label: string;
	value: ReactNode;
}

const StatBlock = ({ label, value }: StatBlockProps) => (
	<div className="flex flex-col gap-1">
		<span className="text-muted-foreground text-sm">{label}</span>
		<span className="text-lg">{value}</span>
	</div>
);

export default GesCloudBillingComponent;
