import { InvalidEmailCell } from "@ext/enterprise/components/admin/settings/components/InvalidEmailCell";
import t from "@ext/localization/locale/translate";
import { Checkbox } from "@ui-kit/Checkbox";
import type { ColumnDef } from "@ui-kit/DataTable";
import { editColumn } from "../../../../../../enterprise/components/admin/ui-kit/table/columns";
import { TABLE_SELECT_COLUMN_CODE } from "../../../../../../enterprise/components/admin/ui-kit/table/TableComponent";
import { GesCommonUserBadge } from "../../../../../../enterpriseCommon/components/roleBadges/GesCommonUserBadge";
import {
	onwerBadgeIcon,
	userBadgesColumnId,
} from "../../../../../../enterpriseCommon/components/roleBadges/UserBadgesConfig";
import { UserBadgesWrapper } from "../../../../../../enterpriseCommon/components/roleBadges/UserBadgesWrapper";
import type { GesCloudMember } from "../types/GesCloudUsersComponentTypes";

export const getGesCloudUsersTableColumns = (isCurrentUserOwner: boolean): ColumnDef<GesCloudMember>[] => {
	return [
		{
			id: TABLE_SELECT_COLUMN_CODE,
			size: 32,
			header: ({ table }) => {
				const changeableRows = table
					.getRowModel()
					.rows.filter(
						(row) =>
							row.original.type === "invite" ||
							(!row.original.isOwner && !(row.original.isAdmin && !isCurrentUserOwner)),
					);

				const allChangeableSelected =
					changeableRows.length && changeableRows.every((row) => row.getIsSelected());
				const someChangeableSelected = changeableRows.some((row) => row.getIsSelected());

				const headerCheckedState = allChangeableSelected
					? true
					: someChangeableSelected
						? "indeterminate"
						: false;

				return (
					<Checkbox
						aria-label="Select all"
						checked={headerCheckedState}
						onCheckedChange={(value) =>
							changeableRows.forEach((row) => {
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
					disabled={
						row.original.type === "user" &&
						(row.original.isOwner || (row.original.isAdmin && !isCurrentUserOwner))
					}
					onCheckedChange={(value) => row.toggleSelected(!!value)}
				/>
			),
			enableSorting: false,
			enableHiding: false,
		},
		...(isCurrentUserOwner ? [editColumn<GesCloudMember>()] : []),
		{
			accessorKey: "email",
			header: t("enterprise-cloud.org-settings.users.email"),
			cell: ({ row }) => <InvalidEmailCell value={row.original.email} />,
		},
		{
			accessorKey: "type",
			header: t("enterprise-cloud.org-settings.users.status-header"),
			cell: ({ row }) => {
				const type = row.original.type;
				return (
					<span>
						{type === "user"
							? t("enterprise-cloud.org-settings.users.status.user")
							: t("enterprise-cloud.org-settings.users.status.invite")}
					</span>
				);
			},
		},
		{
			id: userBadgesColumnId,
			cell: ({ row }) => {
				const item = row.original;

				return item.isAdmin || item.isOwner ? (
					<UserBadgesWrapper>
						<GesCommonUserBadge
							icon={item.isOwner ? onwerBadgeIcon : ""}
							label={
								item.isOwner
									? t("enterprise-cloud.org-settings.users.roles.owner")
									: t("enterprise-cloud.org-settings.users.roles.admin")
							}
						/>
					</UserBadgesWrapper>
				) : null;
			},
		},
	];
};
