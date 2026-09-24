import PageDataContextService from "@core-ui/ContextServices/PageDataContext";
import t from "@ext/localization/locale/translate";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogIcon,
	AlertDialogTitle,
} from "@ui-kit/AlertDialog";
import { Icon } from "@ui-kit/Icon";
import { useCallback, useMemo, useState } from "react";
import { useUiLanguage } from "../../../../../../ui-logic/ContextServices/Language";
import { GesCloudApi } from "../../../../GesCloudApi";

interface CancelSubscriptionModalProps {
	currentPeriodEnd: string | null;
	freeSeatsLimit: number;
	occupiedSeats: number;
	onClose: () => void;
	onConfirm?: () => void;
}

export const CancelSubscriptionModal = ({
	currentPeriodEnd,
	freeSeatsLimit,
	occupiedSeats,
	onClose,
	onConfirm,
}: CancelSubscriptionModalProps) => {
	const { url: gesCloudUrl } = PageDataContextService.value.conf.enterpriseCloud;
	const gesCloudApi = useMemo(() => new GesCloudApi(gesCloudUrl), [gesCloudUrl]);

	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const formattedCurrentPeriodEnd = new Intl.DateTimeFormat(useUiLanguage(), {
		year: "numeric",
		month: "long",
		day: "numeric",
	}).format(new Date(currentPeriodEnd));

	const cancelSubscription = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			await gesCloudApi.cancelSubscription("online_payment");
			onConfirm?.();
			onClose();
		} catch {
			setIsLoading(false);
			setError(t("enterprise-cloud.org-settings.billing.cancel-subscription.error"));
		}
	}, [gesCloudApi, onClose, onConfirm]);

	return (
		<AlertDialog open>
			<AlertDialogContent focus="low" overlayBlur overlayType="default" status="error">
				<AlertDialogHeader>
					<AlertDialogIcon icon="alert-circle" />
					<AlertDialogTitle>
						{t("enterprise-cloud.org-settings.billing.cancel-subscription.title")}
					</AlertDialogTitle>
					<AlertDialogDescription
						className="article !bg-transparent"
						dangerouslySetInnerHTML={{
							// biome-ignore lint/style/useNamingConvention: expected
							__html: t("enterprise-cloud.org-settings.billing.cancel-subscription.description")
								.replace("{{currentPeriodEnd}}", formattedCurrentPeriodEnd)
								.replace("{{freeSeatsLimit}}", freeSeatsLimit),
						}}
					/>
					{occupiedSeats > freeSeatsLimit && (
						<AlertDialogDescription
							className="article !bg-transparent"
							dangerouslySetInnerHTML={{
								// biome-ignore lint/style/useNamingConvention: expected
								__html: t(
									"enterprise-cloud.org-settings.billing.cancel-subscription.seats-overflow-warning",
								)
									.replace("{{occupiedSeats}}", occupiedSeats)
									.replace("{{currentPeriodEnd}}", formattedCurrentPeriodEnd)
									.replace("{{freeSeatsLimit}}", freeSeatsLimit)
									.replace("{{freeSeatsLimit}}", freeSeatsLimit),
							}}
						/>
					)}

					<AlertDialogDescription>
						<span
							className="article !bg-transparent"
							dangerouslySetInnerHTML={{
								// biome-ignore lint/style/useNamingConvention: expected
								__html: t(
									"enterprise-cloud.org-settings.billing.cancel-subscription.payment-method-notice",
								),
							}}
						/>
					</AlertDialogDescription>

					{error && (
						<AlertDialogDescription>
							<div className="mb-3 text-destructive text-sm">{error}</div>
						</AlertDialogDescription>
					)}
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isLoading} onClick={onClose}>
						{t("enterprise-cloud.org-settings.billing.cancel-subscription.close")}
					</AlertDialogCancel>
					{onConfirm && (
						<AlertDialogAction disabled={isLoading} onClick={cancelSubscription}>
							{isLoading && <Icon className="mr-2 h-4 w-4 animate-spin" icon="loader-circle" />}
							{t("enterprise-cloud.org-settings.billing.cancel-subscription.action")}
						</AlertDialogAction>
					)}
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
