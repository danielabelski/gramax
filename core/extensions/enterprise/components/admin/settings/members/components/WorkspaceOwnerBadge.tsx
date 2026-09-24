import { getRoleName } from "@ext/enterprise/components/admin/settings/components/roles/Access";
import { GesCommonUserBadge } from "../../../../../../enterpriseCommon/components/roleBadges/GesCommonUserBadge";
import { onwerBadgeIcon } from "../../../../../../enterpriseCommon/components/roleBadges/UserBadgesConfig";

export const WorkspaceOwnerBadge = () => (
	<GesCommonUserBadge icon={onwerBadgeIcon} label={getRoleName("workspaceOwner")} />
);
