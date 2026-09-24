import DateComponent from "@components/Atoms/Date";
import type { GesCloudPayment } from "@ext/enterprise-cloud/GesCloudApi";
import { formatCurrency } from "@ext/enterprise-cloud/utils/formatCurrency";
import t from "@ext/localization/locale/translate";
import type { ColumnDef } from "@ui-kit/DataTable";

const getPaymentKindLabel = (kind: string): string => {
	switch (kind) {
		case "seat_purchase":
			return t("enterprise-cloud.org-settings.billing.payments.kinds.seat_purchase");
		case "subscription_renewal":
			return t("enterprise-cloud.org-settings.billing.payments.kinds.subscription_renewal");
		case "subscription_recovery":
			return t("enterprise-cloud.org-settings.billing.payments.kinds.subscription_recovery");
		case "ai_wallet_topup":
			return t("enterprise-cloud.org-settings.billing.payments.kinds.ai_wallet_topup");
		case "plan_upgrade":
			return t("enterprise-cloud.org-settings.billing.payments.kinds.plan_upgrade");
		default:
			return kind;
	}
};

const getPaymentStatusLabel = (status: string): string => {
	switch (status) {
		case "pending":
			return t("enterprise-cloud.org-settings.billing.payments.statuses.pending");
		case "succeeded":
			return t("enterprise-cloud.org-settings.billing.payments.statuses.succeeded");
		case "canceled":
			return t("enterprise-cloud.org-settings.billing.payments.statuses.canceled");
		default:
			return status;
	}
};

export const getGesCloudPaymentsTableColumns: () => ColumnDef<GesCloudPayment>[] = () => [
	{
		accessorKey: "date",
		header: t("enterprise-cloud.org-settings.billing.payments.date"),
		cell: ({ row }) => <DateComponent date={new Date(row.original.date)} />,
	},
	{
		accessorKey: "kind",
		header: t("enterprise-cloud.org-settings.billing.payments.kind"),
		cell: ({ row }) => <span>{getPaymentKindLabel(row.original.kind)}</span>,
	},
	{
		accessorKey: "amount",
		header: t("enterprise-cloud.org-settings.billing.payments.amount"),
		cell: ({ row }) => <span>{formatCurrency(row.original.amount, row.original.currency)}</span>,
	},
	{
		accessorKey: "status",
		header: t("enterprise-cloud.org-settings.billing.payments.status"),
		cell: ({ row }) => <span>{getPaymentStatusLabel(row.original.status)}</span>,
	},
];
