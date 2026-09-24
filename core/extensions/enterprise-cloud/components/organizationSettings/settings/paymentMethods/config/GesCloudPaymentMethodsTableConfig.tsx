import t from "@ext/localization/locale/translate";
import { Checkbox } from "@ui-kit/Checkbox";
import type { ColumnDef } from "@ui-kit/DataTable";
import { Icon } from "@ui-kit/Icon";
import { TABLE_SELECT_COLUMN_CODE } from "../../../../../../enterprise/components/admin/ui-kit/table/TableComponent";
import type { GesCloudPaymentMethodRow } from "../types/GesCloudPaymentMethodsComponentTypes";

export const getGesCloudPaymentMethodsTableColumns: () => ColumnDef<GesCloudPaymentMethodRow>[] = () => [
	{
		id: TABLE_SELECT_COLUMN_CODE,
		header: ({ table }) => {
			const selectableRows = table.getRowModel().rows;

			const allSelectableSelected = selectableRows.length && selectableRows.every((row) => row.getIsSelected());
			const someSelectableSelected = selectableRows.some((row) => row.getIsSelected());

			const headerCheckedState = allSelectableSelected ? true : someSelectableSelected ? "indeterminate" : false;

			return (
				<Checkbox
					aria-label="Select all"
					checked={headerCheckedState}
					disabled={!selectableRows.length}
					onCheckedChange={(value) =>
						selectableRows.forEach((row) => {
							row.toggleSelected(!!value);
						})
					}
				/>
			);
		},
		cell: ({ row }) => (
			<Checkbox
				aria-label="Select row"
				checked={row.getIsSelected()}
				onCheckedChange={(value) => row.toggleSelected(!!value)}
			/>
		),
		enableSorting: false,
		enableHiding: false,
		size: 32,
	},
	{
		accessorKey: "title",
		header: t("enterprise-cloud.org-settings.payment-methods.card"),
		cell: ({ row }) => {
			const { title, card } = row.original;
			return <span>{title ?? (card ? `•••• ${card.last4}` : "—")}</span>;
		},
	},
	{
		id: "expiry",
		header: t("enterprise-cloud.org-settings.payment-methods.expiry"),
		cell: ({ row }) => {
			const card = row.original.card;
			return <span>{card ? `${card.expiryMonth}/${card.expiryYear}` : "—"}</span>;
		},
	},
	{
		id: "cardType",
		header: t("enterprise-cloud.org-settings.payment-methods.type"),
		cell: ({ row }) => <span>{row.original.card?.cardType ?? "—"}</span>,
	},
	{
		accessorKey: "isDefault",
		header: t("enterprise-cloud.org-settings.payment-methods.default"),
		cell: ({ row }) => (row.original.isDefault ? <Icon icon="check" /> : null),
	},
];
