import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import { type BillingPeriodCode, GesCloudApi, type GesCloudTariff } from "@ext/enterprise-cloud/GesCloudApi";
import { formatCurrency } from "@ext/enterprise-cloud/utils/formatCurrency";
import t from "@ext/localization/locale/translate";
import { Button } from "@ui-kit/Button";
import { Dialog, DialogBody, DialogContent } from "@ui-kit/Dialog";
import { FormHeader } from "@ui-kit/Form";
import { useCallback, useEffect, useMemo, useState } from "react";

const BILLING_PERIOD_RANK: Record<BillingPeriodCode, number> = { month: 0, year: 1 };

interface TariffChooseModalProps {
	currentBillingPeriod?: string;
	description?: string;
	onClose: () => void;
	onContinue: (billingPeriod: BillingPeriodCode) => void;
}

export const TariffChooseModal = ({
	currentBillingPeriod,
	description,
	onClose,
	onContinue,
}: TariffChooseModalProps) => {
	const { url: gesCloudUrl } = PageDataContextService.value.conf.enterpriseCloud;
	const gesCloudApi = useMemo(() => new GesCloudApi(gesCloudUrl), [gesCloudUrl]);

	const [open, setOpen] = useState(true);
	const [tariffs, setTariffs] = useState<GesCloudTariff[]>([]);
	const [error, setError] = useState<string | null>(null);

	const onOpenChangeHandler = useCallback(
		(value: boolean) => {
			setOpen(value);
			if (!value) onClose();
		},
		[onClose],
	);

	useEffect(() => {
		const loadTariffs = async () => {
			try {
				const data = await gesCloudApi.getTariffs();
				setTariffs(data.tariffs);
			} catch {
				setError(t("enterprise-cloud.org-settings.subscription.load-error"));
			}
		};

		void loadTariffs();
	}, [gesCloudApi]);

	const handleContinue = useCallback(
		(billingPeriod: BillingPeriodCode) => {
			onOpenChangeHandler(false);
			onContinue(billingPeriod);
		},
		[onOpenChangeHandler, onContinue],
	);

	const isActionable = useCallback(
		(billingPeriod: BillingPeriodCode) => {
			if (!currentBillingPeriod) return true;
			return (BILLING_PERIOD_RANK[billingPeriod] ?? 0) > (BILLING_PERIOD_RANK[currentBillingPeriod] ?? 0);
		},
		[currentBillingPeriod],
	);

	const monthly = tariffs.find((tariff) => tariff.billingPeriod === "month");
	const annual = tariffs.find((tariff) => tariff.billingPeriod === "year");

	return (
		<Dialog onOpenChange={onOpenChangeHandler} open={open}>
			<DialogContent data-modal-root>
				<FormHeader
					description={description}
					icon="credit-card"
					title={t("enterprise-cloud.org-settings.subscription.choose-title")}
				/>
				<DialogBody>
					{error && <div className="text-destructive text-sm mb-3">{error}</div>}
					<div className="flex gap-4">
						<TariffPanel
							current={currentBillingPeriod === "month"}
							disabled={Boolean(monthly) && !isActionable("month")}
							onContinue={handleContinue}
							tariff={monthly}
							title={t("enterprise-cloud.org-settings.subscription.monthly-title")}
						/>
						<TariffPanel
							current={currentBillingPeriod === "year"}
							disabled={Boolean(annual) && !isActionable("year")}
							onContinue={handleContinue}
							tariff={annual}
							title={t("enterprise-cloud.org-settings.subscription.annual-title")}
							yearly
						/>
					</div>
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
};

interface TariffPanelProps {
	title: string;
	tariff?: GesCloudTariff;
	yearly?: boolean;
	current?: boolean;
	disabled?: boolean;
	onContinue: (billingPeriod: string) => void;
}

const TariffPanel = ({ title, tariff, yearly, current, disabled, onContinue }: TariffPanelProps) => {
	if (!tariff) return null;

	const priceLabel = `${formatCurrency(tariff.pricePerMonth, tariff.currency)} ${t("enterprise-cloud.org-settings.subscription.per-month")}`;

	return (
		<div className="flex flex-1 flex-col gap-2 rounded-lg border p-4">
			<h3 className="font-medium text-base">{title}</h3>
			<div className="font-semibold text-lg">
				{priceLabel}{" "}
				<span className="font-normal text-muted-foreground text-sm">
					{t("enterprise-cloud.org-settings.subscription.per-editor")}
				</span>
			</div>
			{yearly && (
				<div className="text-muted-foreground text-sm">
					{t("enterprise-cloud.org-settings.subscription.billed-yearly")}:{" "}
					{formatCurrency(tariff.paymentPerPeriod, tariff.currency)}
				</div>
			)}
			<div className="mt-auto pt-2">
				<Button className="w-full" disabled={disabled} onClick={() => onContinue(tariff.billingPeriod)}>
					{current
						? t("enterprise-cloud.org-settings.subscription.current-plan")
						: t("enterprise-cloud.org-settings.subscription.continue")}
				</Button>
			</div>
		</div>
	);
};
