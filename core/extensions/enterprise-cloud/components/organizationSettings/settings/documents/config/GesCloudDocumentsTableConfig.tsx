import DateComponent from "@components/Atoms/Date";
import t from "@ext/localization/locale/translate";
import { Button } from "@ui-kit/Button";
import type { ColumnDef } from "@ui-kit/DataTable";
import type { GesCloudInvoice } from "../types/GesCloudDocumentsComponentTypes";

export const getGesCloudInvoicesTableColumns = (
	downloadInvoice: (invoiceId: string) => void,
): ColumnDef<GesCloudInvoice>[] => {
	return [
		{
			accessorKey: "date",
			header: t("enterprise-cloud.org-settings.documents.date"),
			cell: ({ row }) => <DateComponent date={new Date(row.original.date)} />,
		},
		{
			accessorKey: "number",
			header: t("enterprise-cloud.org-settings.documents.number"),
			cell: ({ row }) => <span>{row.original.number}</span>,
		},
		{
			accessorKey: "download",
			header: "",
			cell: ({ row }) => (
				<Button onClick={() => downloadInvoice(row.original.id)}>
					{t("enterprise-cloud.org-settings.documents.download")}
				</Button>
			),
		},
	];
};
