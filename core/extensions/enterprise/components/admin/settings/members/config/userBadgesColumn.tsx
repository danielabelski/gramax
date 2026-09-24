import { WorkspaceOwnerBadge } from "@ext/enterprise/components/admin/settings/members/components/WorkspaceOwnerBadge";
import t from "@ext/localization/locale/translate";
import type { ColumnDef } from "@ui-kit/DataTable";
import { GesCommonUserBadge } from "../../../../../../enterpriseCommon/components/roleBadges/GesCommonUserBadge";
import { userBadgesColumnId } from "../../../../../../enterpriseCommon/components/roleBadges/UserBadgesConfig";
import { UserBadgesWrapper } from "../../../../../../enterpriseCommon/components/roleBadges/UserBadgesWrapper";

export interface UserBadgesColumnOptions<T> {
	header?: string;
	isEditor?: (row: T) => boolean;
	isWorkspaceOwner?: (row: T) => boolean;
}

export const userBadgesColumn = <T,>({
	header,
	isEditor,
	isWorkspaceOwner,
}: UserBadgesColumnOptions<T>): ColumnDef<T> => ({
	id: userBadgesColumnId,
	header: header ?? "",
	cell: ({ row }) => {
		const item = row.original;

		return (
			<UserBadgesWrapper>
				{<UserBadges isEditor={isEditor?.(item)} isWorkspaceOwner={isWorkspaceOwner?.(item)} />}
			</UserBadgesWrapper>
		);
	},
});

interface MemberBadgesProps {
	isEditor?: boolean;
	isWorkspaceOwner?: boolean;
}

const UserBadges = ({ isEditor, isWorkspaceOwner }: MemberBadgesProps) => (
	<>
		{isEditor && <GesCommonUserBadge label={t("enterprise.admin.users.editor")} />}
		{isWorkspaceOwner && <WorkspaceOwnerBadge />}
	</>
);
