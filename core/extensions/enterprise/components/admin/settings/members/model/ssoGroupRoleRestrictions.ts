import type { RoleId } from "@ext/enterprise/components/admin/settings/components/roles/Access";
import { GroupSource } from "@ext/enterprise/components/admin/settings/workspace/components/access/components/group/types/GroupTypes";

export const isSsoGroupRoleRestricted = (source?: GroupSource): boolean => source === GroupSource.SSO_GROUPS;

export const resolveSsoGroupRole = (source: GroupSource, role: RoleId): RoleId =>
	isSsoGroupRoleRestricted(source) ? "reader" : role;
